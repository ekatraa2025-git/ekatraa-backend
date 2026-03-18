import crypto from 'crypto'
import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/public/payment/verify-balance
 * Verifies Razorpay signature for balance payment and updates order.
 * Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id, user_id }
 */
export async function POST(req: Request) {
    try {
        const keySecret = process.env.RAZORPAY_KEY_SECRET
        if (!keySecret) {
            return NextResponse.json({ error: 'Razorpay not configured' }, { status: 503 })
        }

        const body = await req.json()
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id, user_id } = body

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !order_id) {
            return NextResponse.json({ error: 'Missing payment or order details' }, { status: 400 })
        }

        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex')

        if (expectedSignature !== razorpay_signature) {
            return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
        }

        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('id, user_id, advance_amount, total_amount, status')
            .eq('id', order_id)
            .single()

        if (orderErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        if (user_id && order.user_id !== user_id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        if ((order.status as string) !== 'completed') {
            return NextResponse.json({ error: 'Balance payment is only available after the order is marked complete by the vendor.' }, { status: 400 })
        }

        const advancePaid = Number(order.advance_amount || 0)
        let agreedTotal = Number(order.total_amount || 0)
        const { data: acceptedQuote } = await supabase
            .from('quotations')
            .select('amount')
            .eq('order_id', order_id)
            .eq('status', 'accepted')
            .limit(1)
            .maybeSingle()
        if (acceptedQuote?.amount != null) {
            agreedTotal = Number(acceptedQuote.amount)
        }
        const newAdvance = agreedTotal

        const { data: updated, error: updateErr } = await supabase
            .from('orders')
            .update({
                advance_amount: newAdvance,
                advance_paid_at: new Date().toISOString(),
                razorpay_payment_id: razorpay_payment_id,
                razorpay_order_id: razorpay_order_id,
                status: 'confirmed',
            })
            .eq('id', order_id)
            .select()
            .single()

        if (updateErr) {
            return NextResponse.json({ error: updateErr.message }, { status: 500 })
        }

        await supabase.from('order_status_history').insert({
            order_id: order_id,
            status: 'confirmed',
            note: `Balance payment completed via Razorpay. Full amount paid.`,
        })

        return NextResponse.json(updated, { status: 200 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
