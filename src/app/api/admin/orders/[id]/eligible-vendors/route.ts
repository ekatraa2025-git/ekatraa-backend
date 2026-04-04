import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/orders/[id]/eligible-vendors?order_item_id=
 * Returns vendors whose portfolio includes the order line's catalog service (by catalog_service_id or name match).
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params
    const { searchParams } = new URL(req.url)
    const orderItemId = searchParams.get('order_item_id')
    if (!orderItemId) {
        return NextResponse.json({ error: 'order_item_id required' }, { status: 400 })
    }

    const { data: item, error: itemErr } = await supabase
        .from('order_items')
        .select('id, order_id, service_id, name')
        .eq('id', orderItemId)
        .eq('order_id', orderId)
        .single()

    if (itemErr || !item) {
        return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
    }

    const serviceId = item.service_id as string | null
    const lineName = (item.name as string | null)?.trim() ?? ''

    const { data: allVendors, error: vErr } = await supabase
        .from('vendors')
        .select('id, business_name, city, state, status')
        .eq('status', 'active')
        .order('business_name', { ascending: true })

    if (vErr) {
        return NextResponse.json({ error: vErr.message }, { status: 500 })
    }

    const vendorIdList = (allVendors ?? []).map((v: { id: string }) => v.id)
    const { data: portfolio } =
        vendorIdList.length > 0
            ? await supabase
                  .from('services')
                  .select('id, vendor_id, name, catalog_service_id')
                  .in('vendor_id', vendorIdList)
            : { data: [] }

    const byVendor = new Map<string, { vendor_id: string; name: string | null; catalog_service_id: string | null }[]>()
    for (const row of portfolio ?? []) {
        const vid = (row as { vendor_id: string }).vendor_id
        if (!byVendor.has(vid)) byVendor.set(vid, [])
        byVendor.get(vid)!.push(row as { vendor_id: string; name: string | null; catalog_service_id: string | null })
    }

    const eligible: { id: string; business_name: string; city?: string | null; state?: string | null; match: 'catalog_id' | 'name' }[] = []
    const other: { id: string; business_name: string; city?: string | null; state?: string | null }[] = []

    for (const v of allVendors ?? []) {
        const vid = (v as { id: string }).id
        const lines = byVendor.get(vid) ?? []
        let matched: 'catalog_id' | 'name' | null = null
        if (serviceId) {
            if (lines.some((l) => l.catalog_service_id === serviceId)) matched = 'catalog_id'
            else if (lineName && lines.some((l) => (l.name || '').trim() === lineName)) matched = 'name'
        }
        const row = {
            id: vid,
            business_name: (v as { business_name: string }).business_name,
            city: (v as { city?: string }).city,
            state: (v as { state?: string }).state,
        }
        if (matched) {
            eligible.push({ ...row, match: matched })
        } else {
            other.push(row)
        }
    }

    return NextResponse.json({ eligible, other, order_item: { service_id: serviceId, name: lineName } })
}
