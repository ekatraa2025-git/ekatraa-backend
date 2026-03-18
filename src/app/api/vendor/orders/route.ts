import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

/**
 * GET /api/vendor/orders
 * List orders allocated to the authenticated vendor.
 * Requires: Authorization: Bearer <supabase_access_token>
 */
export async function GET(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    // Orders allocated via orders.vendor_id
    let query = supabase
        .from('orders')
        .select('*')
        .eq('vendor_id', auth.vendorId!)
        .order('created_at', { ascending: false })

    if (status && status !== 'all') {
        query = query.eq('status', status)
    }

    const { data: ordersByVendorId, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Orders where vendor has order_item_allocations (multi-vendor support)
    const { data: allocations } = await supabase
        .from('order_item_allocations')
        .select('order_item_id')
        .eq('vendor_id', auth.vendorId!)
    const allocatedItemIds = (allocations ?? []).map((a: { order_item_id: string }) => a.order_item_id)
    let orderIdsFromAllocations: string[] = []
    if (allocatedItemIds.length > 0) {
        const { data: items } = await supabase
            .from('order_items')
            .select('order_id')
            .in('id', allocatedItemIds)
        orderIdsFromAllocations = [...new Set((items ?? []).map((i: { order_id: string }) => i.order_id))]
    }

    const idsFromVendor = new Set((ordersByVendorId ?? []).map((o: { id: string }) => o.id))
    const extraOrderIds = orderIdsFromAllocations.filter((oid) => !idsFromVendor.has(oid))
    let list = ordersByVendorId ?? []

    if (extraOrderIds.length > 0) {
        const { data: extraOrders } = await supabase
            .from('orders')
            .select('*')
            .in('id', extraOrderIds)
            .order('created_at', { ascending: false })
        if (status && status !== 'all') {
            list = [...list, ...(extraOrders ?? []).filter((o: { status: string }) => o.status === status)]
        } else {
            list = [...list, ...(extraOrders ?? [])]
        }
        list.sort((a: { created_at?: string }, b: { created_at?: string }) =>
            (b.created_at ?? '').localeCompare(a.created_at ?? '')
        )
    }
    if (list.length === 0) {
        return NextResponse.json([])
    }

    const orderIds = list.map((o: { id: string }) => o.id)

    // Fetch order_items for all orders in one query
    const { data: allItems } = await supabase
        .from('order_items')
        .select('id, order_id, service_id, name, quantity, unit_price, options')
        .in('order_id', orderIds)

    const itemsByOrderId = new Map<string, typeof allItems>()
    for (const oid of orderIds) {
        itemsByOrderId.set(oid, (allItems ?? []).filter((i: { order_id: string }) => i.order_id === oid))
    }

    const { data: quotations } = await supabase
        .from('quotations')
        .select('*')
        .eq('vendor_id', auth.vendorId!)
        .in('order_id', orderIds)
        .order('created_at', { ascending: false })
    const orderIdsWithQuotation = new Set((quotations ?? []).map((q: { order_id: string }) => q.order_id))
    const quotationByOrderId = new Map<string, { [k: string]: unknown }>()
    for (const q of quotations ?? []) {
        if (!quotationByOrderId.has(q.order_id)) {
            quotationByOrderId.set(q.order_id, q)
        }
    }

    return NextResponse.json(list.map((o: { id: string; [k: string]: unknown }) => ({
        ...o,
        total_order_price: (itemsByOrderId.get(o.id) ?? []).reduce(
            (sum: number, i: { quantity?: number | string; unit_price?: number | string }) =>
                sum + ((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)),
            0
        ) || Number((o as { total_amount?: number | string }).total_amount ?? 0),
        advance_paid: Number((o as { advance_amount?: number | string }).advance_amount ?? 0),
        balance_due:
            (((itemsByOrderId.get(o.id) ?? []).reduce(
                (sum: number, i: { quantity?: number | string; unit_price?: number | string }) =>
                    sum + ((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)),
                0
            ) || Number((o as { total_amount?: number | string }).total_amount ?? 0))
                - Number((o as { advance_amount?: number | string }).advance_amount ?? 0)),
        items: itemsByOrderId.get(o.id) ?? [],
        quotation_submitted: orderIdsWithQuotation.has(o.id),
        quotation: quotationByOrderId.get(o.id) ?? null,
    })))
}
