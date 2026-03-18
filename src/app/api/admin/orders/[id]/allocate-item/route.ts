import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/admin/orders/[id]/allocate-item
 * Allocate an order item to a vendor. Body: { order_item_id, vendor_id }
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params
    const body = await req.json()
    const { order_item_id, vendor_id } = body

    if (!order_item_id || !vendor_id) {
        return NextResponse.json({ error: 'order_item_id and vendor_id required' }, { status: 400 })
    }

    const { data: item, error: itemErr } = await supabase
        .from('order_items')
        .select('id, order_id')
        .eq('id', order_item_id)
        .eq('order_id', orderId)
        .single()

    if (itemErr || !item) {
        return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
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
