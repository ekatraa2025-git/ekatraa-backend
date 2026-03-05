import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Admin: order detail + status transition (PATCH to update status).
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id)

    const { data: history } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true })

    return NextResponse.json({
        ...order,
        items: items ?? [],
        status_history: history ?? [],
    })
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const body = await req.json()
    const { status, note } = body

    if (!status) {
        return NextResponse.json({ error: 'status required' }, { status: 400 })
    }

    const { data: order, error: updateError } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await supabase.from('order_status_history').insert([
        { order_id: id, status, note: note ?? `Status updated to ${status}` },
    ])

    return NextResponse.json(order)
}
