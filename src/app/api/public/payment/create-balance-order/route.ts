import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

/**
 * POST /api/public/payment/create-balance-order
 * Creates Razorpay order for balance payment on an existing order.
 * Body: { order_id, user_id, balance_amount }
 */
export async function POST(req: Request) {
    try {
        const keyId = process.env.RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET
        if (!keyId || !keySecret) {
            return NextResponse.json({ error: 'Razorpay not configured' }, { status: 503 })
        }

        const body = await req.json()
        const { order_id, user_id, balance_amount } = body

        if (!order_id || !user_id) {
            return NextResponse.json({ error: 'order_id and user_id required' }, { status: 400 })
        }

        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('id, user_id, total_amount, advance_amount, status')
            .eq('id', order_id)
            .single()

        if (orderErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        if (order.user_id !== user_id) {
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
        const balance = balance_amount != null
            ? Math.round(Number(balance_amount))
            : Math.max(0, Math.round(agreedTotal - advancePaid))

        if (balance <= 0) {
            return NextResponse.json({ error: 'No balance to pay' }, { status: 400 })
        }

        const amountInPaise = Math.max(balance * 100, 100)

        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
        const rzOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `bal_${String(order_id).slice(-8)}_${Date.now().toString(36)}`,
            notes: { order_id: String(order_id), user_id: String(user_id), type: 'balance' },
        })

        return NextResponse.json({
            razorpay_order_id: rzOrder.id,
            amount: amountInPaise,
            balance_amount: balance,
            key: keyId,
        })
    } catch (e) {
        const err = e as Error & { error?: { description?: string }; statusCode?: number }
        const msg = err?.error?.description || err?.message || String(e)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
