import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/orders/[id]
 * Order detail with items and status history.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    }

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
        .select('id, service_id, name, quantity, unit_price, options')
        .eq('order_id', id)

    const { data: history } = await supabase
        .from('order_status_history')
        .select('status, note, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: true })

    return NextResponse.json({
        ...order,
        items: items ?? [],
        status_history: history ?? [],
    })
}
