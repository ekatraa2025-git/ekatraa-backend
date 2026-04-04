import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    await supabase.from('order_item_allocations').delete().eq('order_item_id', orderItemId)

    return NextResponse.json({ success: true })
}
