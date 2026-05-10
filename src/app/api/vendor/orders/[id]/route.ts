import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorFromRequest, isTeamMemberAssignedToOrder } from '@/lib/vendor-auth'

type OrderItemRow = {
    id: string
    service_id?: string | null
    name?: string | null
    quantity?: number | string | null
    unit_price?: number | string | null
    options?: unknown
}

function calcItemsTotal(items: OrderItemRow[]): number {
    return items.reduce(
        (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
        0
    )
}

function withLineTotals(items: OrderItemRow[], orderTotal: number): Array<OrderItemRow & {
    line_total: number
    line_percentage_of_order: number
}> {
    return items.map((i) => {
        const lineTotal = (Number(i.quantity) || 0) * (Number(i.unit_price) || 0)
        const ratio = orderTotal > 0 ? Math.min(1, Math.max(0, lineTotal / orderTotal)) : 0
        return {
            ...i,
            line_total: lineTotal,
            line_percentage_of_order: Math.round(ratio * 10000) / 100,
        }
    })
}

/**
 * GET /api/vendor/orders/[id]
 * Order detail for the authenticated vendor (only if allocated to them).
 * Requires: Authorization: Bearer <supabase_access_token>
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    }

    let { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const hasOrderLevelAllocation = (order as { vendor_id?: string }).vendor_id === auth.vendorId
    let hasItemAllocation = false
    if (!hasOrderLevelAllocation) {
        const { data: items } = await supabase.from('order_items').select('id').eq('order_id', id)
        const itemIds = (items ?? []).map((i: { id: string }) => i.id)
        if (itemIds.length > 0) {
            const { data: alloc } = await supabase
                .from('order_item_allocations')
                .select('id')
                .eq('vendor_id', auth.vendorId!)
                .in('order_item_id', itemIds)
                .limit(1)
            hasItemAllocation = (alloc?.length ?? 0) > 0
        }
    }
    if (!hasOrderLevelAllocation && !hasItemAllocation) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (!(await isTeamMemberAssignedToOrder(auth, id))) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: items } = await supabase
        .from('order_items')
        .select('id, service_id, name, quantity, unit_price, options')
        .eq('order_id', id)

    const orderItems = (items ?? []) as OrderItemRow[]
    const itemIds = orderItems.map((i) => i.id)
    let visibleItems = orderItems
    let hasItemLevelAllocations = false
    if (itemIds.length > 0) {
        const { data: allAllocations } = await supabase
            .from('order_item_allocations')
            .select('order_item_id, vendor_id')
            .in('order_item_id', itemIds)
        const allocRows = (allAllocations ?? []) as { order_item_id: string; vendor_id: string }[]
        hasItemLevelAllocations = allocRows.length > 0
        if (hasItemLevelAllocations) {
            const mine = new Set(
                allocRows
                    .filter((a) => a.vendor_id === auth.vendorId)
                    .map((a) => a.order_item_id)
            )
            visibleItems = orderItems.filter((i) => mine.has(i.id))
            if (visibleItems.length === 0) {
                return NextResponse.json({ error: 'Order not found' }, { status: 404 })
            }
        }
    }

    const { data: history } = await supabase
        .from('order_status_history')
        .select('id, status, note, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: true })

    const { data: quotations } = await supabase
        .from('quotations')
        .select('*')
        .eq('order_id', id)
        .eq('vendor_id', auth.vendorId!)
        .order('created_at', { ascending: false })

    const { data: vendorInvoice } = await supabase
        .from('order_vendor_invoices')
        .select('*')
        .eq('order_id', id)
        .eq('vendor_id', auth.vendorId!)
        .maybeSingle()

    const fullOrderTotal = calcItemsTotal(orderItems) || Number((order as { total_amount?: number | string }).total_amount ?? 0)
    const allocatedItemsTotal = calcItemsTotal(visibleItems)
    const totalForVendor = hasItemLevelAllocations ? allocatedItemsTotal : (fullOrderTotal || allocatedItemsTotal)
    const coverageRatio =
        fullOrderTotal > 0
            ? Math.min(1, Math.max(0, totalForVendor / fullOrderTotal))
            : 1
    const rawAdvance = Number((order as { advance_amount?: number | string }).advance_amount ?? 0)
    const advancePaid = rawAdvance * coverageRatio

    return NextResponse.json({
        ...order,
        items: withLineTotals(visibleItems, fullOrderTotal),
        status_history: history ?? [],
        quotations: quotations ?? [],
        quotation: (quotations ?? [])[0] ?? null,
        vendor_invoice: vendorInvoice ?? null,
        full_order_total: fullOrderTotal,
        allocated_items_total: totalForVendor,
        allocated_scope_percentage: Math.round(coverageRatio * 10000) / 100,
        total_order_price: totalForVendor,
        allocated_scope_amount: totalForVendor,
        full_order_advance_paid: rawAdvance,
        allocated_scope_advance_paid: advancePaid,
        advance_paid: advancePaid,
        allocated_advance_paid: advancePaid,
        amount_paid_for_allocated_services: advancePaid,
        balance_due: totalForVendor - advancePaid,
        allocated_scope_balance_due: totalForVendor - advancePaid,
    })
}
