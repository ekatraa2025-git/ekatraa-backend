import { supabase } from '@/lib/supabase/server'

export type PlanningOrderSnapshot = {
    order_id: string
    status: string
    event_name: string | null
    event_date: string | null
    total_amount: number | null
    advance_amount: number | null
    vendor_id: string | null
    vendor_name: string | null
    items: Array<{ name: string | null; quantity: number; unit_price: number }>
    allocations: Array<{ service_name: string | null; vendor_name: string | null; vendor_city: string | null }>
    accepted_quotation: { amount: number | null; vendor_name: string | null; status: string | null } | null
}

/**
 * Recent orders + vendor allocations for Mastra planning context (server-side only).
 */
export async function fetchUserOrderPlanningContext(userId: string, limit = 5): Promise<PlanningOrderSnapshot[]> {
    const { data: orders } = await supabase
        .from('orders')
        .select('id, status, event_name, event_date, total_amount, advance_amount, vendor_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (!orders?.length) return []

    const orderIds = orders.map((o: { id: string }) => o.id)
    const vendorIds = [...new Set(orders.map((o: { vendor_id?: string }) => o.vendor_id).filter(Boolean))] as string[]

    const { data: orderItemRows } = await supabase.from('order_items').select('id, order_id, name, quantity, unit_price').in('order_id', orderIds)
    const orderItemIds = (orderItemRows ?? []).map((i: { id: string }) => i.id)

    const [{ data: allocations }, { data: quotations }, { data: vendors }] = await Promise.all([
        orderItemIds.length
            ? supabase
                  .from('order_item_allocations')
                  .select('order_item_id, vendor_id, order_items(order_id, name)')
                  .in('order_item_id', orderItemIds)
            : Promise.resolve({ data: [] }),
        supabase
            .from('quotations')
            .select('order_id, amount, status, vendor_id')
            .in('order_id', orderIds)
            .eq('status', 'accepted'),
        vendorIds.length
            ? supabase.from('vendors').select('id, business_name, city').in('id', vendorIds)
            : Promise.resolve({ data: [] as { id: string; business_name: string; city?: string }[] }),
    ])
    const items = orderItemRows

    const vendorsMap = new Map<string, { business_name: string; city?: string }>()
    for (const v of vendors ?? []) {
        vendorsMap.set(v.id, { business_name: v.business_name, city: v.city })
    }

    const itemsByOrder = new Map<string, PlanningOrderSnapshot['items']>()
    for (const row of items ?? []) {
        const oid = (row as { order_id: string }).order_id
        const list = itemsByOrder.get(oid) ?? []
        list.push({
            name: (row as { name?: string }).name ?? null,
            quantity: Number((row as { quantity?: number }).quantity || 0),
            unit_price: Number((row as { unit_price?: number }).unit_price || 0),
        })
        itemsByOrder.set(oid, list)
    }

    const allocByOrder = new Map<string, PlanningOrderSnapshot['allocations']>()
    for (const row of allocations ?? []) {
        const oi = (row as { order_items?: { order_id?: string; name?: string } }).order_items
        const oid = oi?.order_id
        if (!oid) continue
        const vid = (row as { vendor_id?: string }).vendor_id
        const v = vid ? vendorsMap.get(vid) : undefined
        const list = allocByOrder.get(oid) ?? []
        list.push({
            service_name: oi?.name ?? null,
            vendor_name: v?.business_name ?? null,
            vendor_city: v?.city ?? null,
        })
        allocByOrder.set(oid, list)
    }

    const quoteByOrder = new Map<string, PlanningOrderSnapshot['accepted_quotation']>()
    for (const q of quotations ?? []) {
        const oid = (q as { order_id: string }).order_id
        const vid = (q as { vendor_id?: string }).vendor_id
        quoteByOrder.set(oid, {
            amount: Number((q as { amount?: number }).amount ?? 0) || null,
            vendor_name: vid ? vendorsMap.get(vid)?.business_name ?? null : null,
            status: String((q as { status?: string }).status || 'accepted'),
        })
    }

    return orders.map((o: Record<string, unknown>) => {
        const oid = String(o.id)
        const vid = o.vendor_id ? String(o.vendor_id) : null
        const v = vid ? vendorsMap.get(vid) : undefined
        return {
            order_id: oid,
            status: String(o.status || ''),
            event_name: o.event_name ? String(o.event_name) : null,
            event_date: o.event_date ? String(o.event_date) : null,
            total_amount: o.total_amount != null ? Number(o.total_amount) : null,
            advance_amount: o.advance_amount != null ? Number(o.advance_amount) : null,
            vendor_id: vid,
            vendor_name: v?.business_name ?? null,
            items: itemsByOrder.get(oid) ?? [],
            allocations: allocByOrder.get(oid) ?? [],
            accepted_quotation: quoteByOrder.get(oid) ?? null,
        }
    })
}

export function formatPlanningOrderContextForPrompt(snapshots: PlanningOrderSnapshot[]): string {
    if (!snapshots.length) return ''
    try {
        return `\nUser order context (recent orders, vendor allocations, accepted quotes — use for precise follow-ups):\n${JSON.stringify(snapshots).slice(0, 6000)}`
    } catch {
        return ''
    }
}
