import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin-session'

/**
 * Admin: list orders, filter by status and allocation. Joins vendors for vendor_name when allocated.
 * Includes allocation_count and allocation_vendors from order_item_allocations (multi-vendor support).
 */
export async function GET(req: Request) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const allocated = searchParams.get('allocated')
    const vendorId = searchParams.get('vendor_id')

    let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (vendorId) query = query.eq('vendor_id', vendorId)

    const { data: orders, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let result = orders ?? []

    // Fetch order_item_allocations for all orders
    const orderIds = result.map((o: { id: string }) => o.id)
    const { data: allItems } = await supabase
        .from('order_items')
        .select('id, order_id')
        .in('order_id', orderIds)
    const itemIds = (allItems ?? []).map((i: { id: string }) => i.id)
    const itemToOrderId = new Map((allItems ?? []).map((i: { id: string; order_id: string }) => [i.id, i.order_id]))

    let allocationsByOrderId = new Map<string, { vendor_id: string }[]>()
    if (itemIds.length > 0) {
        const { data: allocations } = await supabase
            .from('order_item_allocations')
            .select('order_item_id, vendor_id')
            .in('order_item_id', itemIds)
        for (const a of allocations ?? []) {
            const oid = itemToOrderId.get((a as { order_item_id: string }).order_item_id)
            if (oid) {
                const list = allocationsByOrderId.get(oid) ?? []
                list.push({ vendor_id: (a as { vendor_id: string }).vendor_id })
                allocationsByOrderId.set(oid, list)
            }
        }
    }

    const allVendorIds = new Set<string>()
    result.forEach((o: { vendor_id?: string | null }) => {
        if (o.vendor_id) allVendorIds.add(o.vendor_id)
    })
    allocationsByOrderId.forEach((list) => {
        list.forEach((a) => allVendorIds.add(a.vendor_id))
    })

    let vendorsMap = new Map<string, { business_name: string; city?: string }>()
    if (allVendorIds.size > 0) {
        const { data: vendors } = await supabase
            .from('vendors')
            .select('id, business_name, city')
            .in('id', Array.from(allVendorIds))
        for (const v of vendors ?? []) {
            vendorsMap.set((v as { id: string }).id, {
                business_name: (v as { business_name: string }).business_name,
                city: (v as { city?: string }).city,
            })
        }
    }

    const isAllocated = (o: { id: string; vendor_id?: string | null }) => {
        const hasOrderVendor = !!o.vendor_id && o.vendor_id !== ''
        const itemAllocs = allocationsByOrderId.get(o.id) ?? []
        return hasOrderVendor || itemAllocs.length > 0
    }

    if (allocated === 'false') {
        result = result.filter((o: { id: string; vendor_id?: string | null }) => !isAllocated(o))
    } else if (allocated === 'true') {
        result = result.filter((o: { id: string; vendor_id?: string | null }) => isAllocated(o))
    }

    const data = result.map((order: { vendor_id?: string | null; id: string; [k: string]: unknown }) => {
        const itemAllocs = allocationsByOrderId.get(order.id as string) ?? []
        const vendorIdsFromItems = [...new Set(itemAllocs.map((a) => a.vendor_id))]
        const orderVendorId = order.vendor_id as string | null | undefined
        const uniqueVendorIds = [...new Set([...(orderVendorId ? [orderVendorId] : []), ...vendorIdsFromItems])]
        const allocationCount = uniqueVendorIds.length
        const allocationVendors = uniqueVendorIds.map((vid) => ({
            vendor_id: vid,
            vendor_name: vendorsMap.get(vid)?.business_name ?? null,
            city: vendorsMap.get(vid)?.city ?? null,
        }))
        return {
            ...order,
            vendor_name: orderVendorId ? vendorsMap.get(orderVendorId)?.business_name ?? null : (allocationCount > 0 ? allocationVendors[0]?.vendor_name ?? null : null),
            allocation_count: allocationCount,
            allocation_vendors: allocationVendors,
        }
    })

    return NextResponse.json(data)
}
