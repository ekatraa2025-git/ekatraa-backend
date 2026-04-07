import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function normalizeCategoryValue(value: string | null | undefined): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-')
}

function vendorMatchesLineCategory(
    vendor: { category?: string | null; category_id?: string | null },
    line: { category_id?: string | null; category_name?: string | null }
): boolean {
    const vendorCategory = normalizeCategoryValue(vendor.category)
    const vendorCategoryId = normalizeCategoryValue(vendor.category_id)
    const lineCategoryId = normalizeCategoryValue(line.category_id)
    const lineCategoryName = normalizeCategoryValue(line.category_name)

    if (!lineCategoryId && !lineCategoryName) return true
    if (lineCategoryId && (vendorCategory === lineCategoryId || vendorCategoryId === lineCategoryId)) return true
    if (lineCategoryName && (vendorCategory === lineCategoryName || vendorCategoryId === lineCategoryName)) return true
    if (lineCategoryId && lineCategoryName && (vendorCategory === lineCategoryName || vendorCategoryId === lineCategoryName)) return true
    return false
}

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
    let lineCategoryId: string | null = null
    let lineCategoryName: string | null = null

    if (serviceId) {
        const { data: svc } = await supabase
            .from('offerable_services')
            .select('id, name, category_id')
            .eq('id', serviceId)
            .maybeSingle()
        if (svc) {
            lineCategoryId = (svc as { category_id?: string | null }).category_id ?? null
            if (!lineName && (svc as { name?: string | null }).name) {
                // Keep parity with existing name-based portfolio fallback.
                // lineName is const, so no reassignment; this just improves debug payload below.
            }
        }
    }
    if (lineCategoryId) {
        const { data: cat } = await supabase
            .from('categories')
            .select('id, name')
            .eq('id', lineCategoryId)
            .maybeSingle()
        lineCategoryName = (cat as { name?: string | null } | null)?.name ?? null
    }

    const { data: allVendors, error: vErr } = await supabase
        .from('vendors')
        .select('id, business_name, city, state, status, category, category_id')
        .eq('status', 'active')
        .order('business_name', { ascending: true })

    if (vErr) {
        return NextResponse.json({ error: vErr.message }, { status: 500 })
    }

    const categoryMatchedVendors = (allVendors ?? []).filter((v) =>
        vendorMatchesLineCategory(
            v as { category?: string | null; category_id?: string | null },
            { category_id: lineCategoryId, category_name: lineCategoryName }
        )
    )

    const vendorIdList = categoryMatchedVendors.map((v: { id: string }) => v.id)
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

    for (const v of categoryMatchedVendors ?? []) {
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

    return NextResponse.json({
        eligible,
        other,
        order_item: {
            service_id: serviceId,
            name: lineName,
            category_id: lineCategoryId,
            category_name: lineCategoryName,
        },
    })
}
