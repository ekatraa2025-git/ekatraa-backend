import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * POST /api/public/orders/[id]/invoice/accept
 * Customer accepts vendor final invoice → locks invoice, sets orders.total_amount for balance payment.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { id: orderId } = await params
    if (!orderId) return NextResponse.json({ error: 'Order id required' }, { status: 400 })

    const { data: order, error: orderErr } = await supabase.from('orders').select('id, user_id, status').eq('id', orderId).single()
    if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.user_id !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    if ((order.status as string) !== 'completed') {
        return NextResponse.json({ error: 'Invoice can only be accepted after the order is completed.' }, { status: 400 })
    }

    const { data: inv, error: invErr } = await supabase
        .from('order_vendor_invoices')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle()

    if (invErr || !inv) {
        return NextResponse.json({ error: 'No invoice found for this order.' }, { status: 404 })
    }
    if (inv.status === 'accepted') {
        return NextResponse.json({ error: 'Invoice already accepted.' }, { status: 400 })
    }
    if (inv.status !== 'submitted') {
        return NextResponse.json({ error: 'Invoice is not awaiting acceptance.' }, { status: 400 })
    }

    const total = Number(inv.total_amount || 0)
    if (total <= 0) {
        return NextResponse.json({ error: 'Invalid invoice total.' }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const { error: upInv } = await supabase
        .from('order_vendor_invoices')
        .update({ status: 'accepted', accepted_at: nowIso, updated_at: nowIso })
        .eq('order_id', orderId)

    if (upInv) {
        return NextResponse.json({ error: upInv.message }, { status: 500 })
    }

    const { error: upOrd } = await supabase.from('orders').update({ total_amount: total }).eq('id', orderId)
    if (upOrd) {
        return NextResponse.json({ error: upOrd.message }, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        order_id: orderId,
        total_amount: total,
        invoice: { ...inv, status: 'accepted', accepted_at: nowIso },
    })
}
