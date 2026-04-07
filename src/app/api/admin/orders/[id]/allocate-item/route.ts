import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNotificationToVendor } from '@/lib/notifications'

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

async function vendorMatchesOrderItem(
    vendorId: string,
    serviceId: string | null,
    lineName: string | null
): Promise<boolean> {
    const { data: lines } = await supabase
        .from('services')
        .select('name, catalog_service_id')
        .eq('vendor_id', vendorId)
    const name = (lineName || '').trim()
    for (const row of lines ?? []) {
        const r = row as { name: string | null; catalog_service_id: string | null }
        if (serviceId && r.catalog_service_id === serviceId) return true
        if (name && (r.name || '').trim() === name) return true
    }
    return false
}

/**
 * POST /api/admin/orders/[id]/allocate-item
 * Allocate an order item to a vendor. Body: { order_item_id, vendor_id, override?: boolean }
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params
    const body = await req.json()
    const { order_item_id, vendor_id, override } = body

    if (!order_item_id || !vendor_id) {
        return NextResponse.json({ error: 'order_item_id and vendor_id required' }, { status: 400 })
    }

    const { data: item, error: itemErr } = await supabase
        .from('order_items')
        .select('id, order_id, service_id, name')
        .eq('id', order_item_id)
        .eq('order_id', orderId)
        .single()

    if (itemErr || !item) {
        return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
    }

    const serviceId = item.service_id as string | null
    const lineName = (item.name as string | null) ?? null
    const { data: previousAllocation } = await supabase
        .from('order_item_allocations')
        .select('vendor_id')
        .eq('order_item_id', order_item_id)
        .maybeSingle()

    let lineCategoryId: string | null = null
    let lineCategoryName: string | null = null
    if (serviceId) {
        const { data: svc } = await supabase
            .from('offerable_services')
            .select('id, category_id')
            .eq('id', serviceId)
            .maybeSingle()
        lineCategoryId = (svc as { category_id?: string | null } | null)?.category_id ?? null
    }
    if (lineCategoryId) {
        const { data: cat } = await supabase
            .from('categories')
            .select('id, name')
            .eq('id', lineCategoryId)
            .maybeSingle()
        lineCategoryName = (cat as { name?: string | null } | null)?.name ?? null
    }

    const { data: vendor, error: vendorErr } = await supabase
        .from('vendors')
        .select('id, business_name, category, category_id')
        .eq('id', vendor_id)
        .maybeSingle()
    if (vendorErr || !vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    if (
        !vendorMatchesLineCategory(
            vendor as { category?: string | null; category_id?: string | null },
            { category_id: lineCategoryId, category_name: lineCategoryName }
        )
    ) {
        return NextResponse.json(
            {
                error:
                    'Vendor category does not match this service category and cannot be allocated to this order item.',
            },
            { status: 422 }
        )
    }

    if (override !== true) {
        const ok = await vendorMatchesOrderItem(vendor_id, serviceId, lineName)
        if (!ok) {
            return NextResponse.json(
                {
                    error:
                        'Vendor does not offer this catalog service in their portfolio. Pass override: true to allocate anyway.',
                },
                { status: 422 }
            )
        }
    }

    const { error: allocErr } = await supabase
        .from('order_item_allocations')
        .upsert({ order_item_id, vendor_id }, { onConflict: 'order_item_id' })

    if (allocErr) {
        return NextResponse.json({ error: allocErr.message }, { status: 500 })
    }

    const prevVendorId = (previousAllocation as { vendor_id?: string } | null)?.vendor_id ?? null
    if (prevVendorId && prevVendorId !== vendor_id) {
        sendNotificationToVendor({
            vendor_id: prevVendorId,
            type: 'booking_update',
            title: 'Item allocation changed',
            message: `An order item allocation was reassigned by admin for order ${orderId.slice(0, 8)}…`,
            data: { order_id: orderId, order_item_id, event: 'reassigned_away' },
        }).catch(() => {
            /* non-fatal */
        })
    }
    sendNotificationToVendor({
        vendor_id,
        type: 'booking_update',
        title: 'New item allocated',
        message: `A service item has been allocated to you by admin for order ${orderId.slice(0, 8)}…`,
        data: { order_id: orderId, order_item_id, service_id: serviceId, service_name: lineName },
    }).catch(() => {
        /* non-fatal */
    })

    return NextResponse.json({ success: true })
}

/**
 * DELETE /api/admin/orders/[id]/allocate-item?order_item_id=xxx
 * Remove allocation for an order item.
 */
export async function DELETE(
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
        .select('id, order_id')
        .eq('id', orderItemId)
        .eq('order_id', orderId)
        .single()

    if (itemErr || !item) {
        return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
    }

    const { data: previousAllocation } = await supabase
        .from('order_item_allocations')
        .select('vendor_id')
        .eq('order_item_id', orderItemId)
        .maybeSingle()
    await supabase.from('order_item_allocations').delete().eq('order_item_id', orderItemId)
    const prevVendorId = (previousAllocation as { vendor_id?: string } | null)?.vendor_id
    if (prevVendorId) {
        sendNotificationToVendor({
            vendor_id: prevVendorId,
            type: 'booking_update',
            title: 'Item allocation removed',
            message: `An order item allocation was removed by admin for order ${orderId.slice(0, 8)}…`,
            data: { order_id: orderId, order_item_id: orderItemId, event: 'deallocated' },
        }).catch(() => {
            /* non-fatal */
        })
    }

    return NextResponse.json({ success: true })
}
