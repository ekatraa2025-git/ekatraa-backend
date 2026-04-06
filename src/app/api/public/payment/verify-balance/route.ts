import crypto from 'crypto'
import Razorpay from 'razorpay'
import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * POST /api/public/payment/verify-balance
 * Verifies Razorpay signature for balance payment and updates order.
 * Requires Authorization: Bearer (same as create-balance-order).
 * Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id }
 */
export async function POST(req: Request) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const keyId = process.env.RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET
        if (!keyId || !keySecret) {
            return NextResponse.json({ error: 'Razorpay not configured' }, { status: 503 })
        }

        const body = await req.json()
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id } = body

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !order_id) {
            return NextResponse.json({ error: 'Missing payment or order details' }, { status: 400 })
        }

        // 1. Verify Razorpay HMAC signature
        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex')

        if (expectedSignature !== razorpay_signature) {
            return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
        }

        // 2. Fetch the Razorpay order to get the authoritative charged amount
        //    and verify it was created for this specific order_id
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
        let rzpOrder: { amount: number; notes?: Record<string, string> }
        try {
            rzpOrder = await razorpay.orders.fetch(razorpay_order_id) as typeof rzpOrder
        } catch {
            return NextResponse.json({ error: 'Could not fetch Razorpay order' }, { status: 400 })
        }

        // Verify the Razorpay order was created for this order_id (prevents order substitution)
        if (rzpOrder.notes?.order_id && rzpOrder.notes.order_id !== String(order_id)) {
            return NextResponse.json({ error: 'Payment order does not match this order' }, { status: 400 })
        }

        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('id, user_id, advance_amount, total_amount, status')
            .eq('id', order_id)
            .single()

        if (orderErr || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        if (order.user_id !== userId) {
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

        // 3. Verify the Razorpay-charged amount matches the expected balance
        const expectedBalancePaise = Math.max(Math.round((agreedTotal - advancePaid) * 100), 100)
        if (Math.abs(rzpOrder.amount - expectedBalancePaise) > 100) {
            return NextResponse.json({ error: 'Payment amount does not match balance due' }, { status: 400 })
        }

        // Use the actual charged amount (from Razorpay) to compute the new total paid
        const balancePaid = rzpOrder.amount / 100
        const newAdvance = advancePaid + balancePaid

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
