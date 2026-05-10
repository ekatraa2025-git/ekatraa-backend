import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

type OrderItemRow = {
    id: string
    order_id: string
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

    if (auth.isTeamMember && auth.teamMemberId) {
        const { data: assignmentRows } = await supabase
            .from('vendor_order_team_assignments')
            .select('order_id')
            .eq('vendor_id', auth.vendorId!)
            .eq('team_member_id', auth.teamMemberId)
        const assignedOrderIds = new Set((assignmentRows ?? []).map((row: { order_id: string }) => row.order_id))
        list = list.filter((o: { id: string }) => assignedOrderIds.has(o.id))
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

    const itemsByOrderId = new Map<string, OrderItemRow[]>()
    for (const oid of orderIds) {
        itemsByOrderId.set(oid, ((allItems ?? []).filter((i: { order_id: string }) => i.order_id === oid) as OrderItemRow[]))
    }

    const allItemIds = (allItems ?? []).map((i: { id: string }) => i.id)
    const allocatedItemIdsByOrder = new Map<string, Set<string>>()
    if (allItemIds.length > 0) {
        const { data: myAllocations } = await supabase
            .from('order_item_allocations')
            .select('order_item_id')
            .eq('vendor_id', auth.vendorId!)
            .in('order_item_id', allItemIds)

        const myItemIdSet = new Set((myAllocations ?? []).map((a: { order_item_id: string }) => a.order_item_id))
        for (const oid of orderIds) {
            const ids = (itemsByOrderId.get(oid) ?? [])
                .map((i) => i.id)
                .filter((id) => myItemIdSet.has(id))
            allocatedItemIdsByOrder.set(oid, new Set(ids))
        }
    }

    const orderIdsWithAnyItemAllocation = new Set<string>()
    if (allItemIds.length > 0) {
        const { data: anyAllocations } = await supabase
            .from('order_item_allocations')
            .select('order_item_id')
            .in('order_item_id', allItemIds)
        const allocatedIds = new Set((anyAllocations ?? []).map((a: { order_item_id: string }) => a.order_item_id))
        for (const oid of orderIds) {
            const hasAny = (itemsByOrderId.get(oid) ?? []).some((i) => allocatedIds.has(i.id))
            if (hasAny) orderIdsWithAnyItemAllocation.add(oid)
        }
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

    const { data: vendorInvoices } = await supabase
        .from('order_vendor_invoices')
        .select('order_id, status, total_amount, submitted_at, accepted_at')
        .eq('vendor_id', auth.vendorId!)
        .in('order_id', orderIds)

    const vendorInvoiceByOrderId = new Map<string, Record<string, unknown>>()
    for (const row of vendorInvoices ?? []) {
        const oid = (row as { order_id: string }).order_id
        if (oid) vendorInvoiceByOrderId.set(oid, row as Record<string, unknown>)
    }

    return NextResponse.json(
        list
        .map((o: { id: string; [k: string]: unknown }) => {
            const allOrderItems = itemsByOrderId.get(o.id) ?? []
            const hasItemLevelAllocations = orderIdsWithAnyItemAllocation.has(o.id)
            const allocatedIds = allocatedItemIdsByOrder.get(o.id) ?? new Set<string>()
            const visibleItems = hasItemLevelAllocations
                ? allOrderItems.filter((i) => allocatedIds.has(i.id))
                : allOrderItems
            if (hasItemLevelAllocations && visibleItems.length === 0) return null

            const fullOrderTotal = calcItemsTotal(allOrderItems) || Number((o as { total_amount?: number | string }).total_amount ?? 0)
            const allocatedItemsTotal = calcItemsTotal(visibleItems)
            const totalForVendor = hasItemLevelAllocations
                ? allocatedItemsTotal
                : (fullOrderTotal || allocatedItemsTotal)
            const coverageRatio =
                fullOrderTotal > 0
                    ? Math.min(1, Math.max(0, totalForVendor / fullOrderTotal))
                    : 1
            const rawAdvance = Number((o as { advance_amount?: number | string }).advance_amount ?? 0)
            const allocatedAdvance = rawAdvance * coverageRatio

            return {
                ...o,
                items: withLineTotals(visibleItems, fullOrderTotal),
                full_order_total: fullOrderTotal,
                allocated_items_total: totalForVendor,
                allocated_scope_percentage: Math.round(coverageRatio * 10000) / 100,
                total_order_price: totalForVendor,
                allocated_scope_amount: totalForVendor,
                full_order_advance_paid: rawAdvance,
                allocated_scope_advance_paid: allocatedAdvance,
                advance_paid: allocatedAdvance,
                allocated_advance_paid: allocatedAdvance,
                amount_paid_for_allocated_services: allocatedAdvance,
                balance_due: totalForVendor - allocatedAdvance,
                allocated_scope_balance_due: totalForVendor - allocatedAdvance,
                quotation_submitted: orderIdsWithQuotation.has(o.id),
                quotation: quotationByOrderId.get(o.id) ?? null,
                vendor_invoice: vendorInvoiceByOrderId.get(o.id) ?? null,
            }
        })
        .filter(Boolean)
    )
}
