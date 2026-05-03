import crypto from 'crypto'
import Razorpay from 'razorpay'
import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * POST /api/public/e-invites/payment/verify
 * Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature, user_e_invite_id }
 */
export async function POST(req: Request) {
    try {
        const keyId = process.env.RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET
        if (!keyId || !keySecret) {
            return NextResponse.json({ error: 'Razorpay not configured' }, { status: 503 })
        }

        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const body = await req.json().catch(() => ({}))
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, user_e_invite_id } = body

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !user_e_invite_id) {
            return NextResponse.json({ error: 'Missing payment or invite id' }, { status: 400 })
        }

        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex')

        if (expectedSignature !== razorpay_signature) {
            return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
        }

        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
        let rzpOrder: { amount: number; notes?: Record<string, string> }
        try {
            rzpOrder = (await razorpay.orders.fetch(razorpay_order_id)) as typeof rzpOrder
        } catch {
            return NextResponse.json({ error: 'Could not fetch Razorpay order' }, { status: 400 })
        }

        if (rzpOrder.notes?.user_e_invite_id && rzpOrder.notes.user_e_invite_id !== String(user_e_invite_id)) {
            return NextResponse.json({ error: 'Payment order does not match e-invite' }, { status: 400 })
        }

        const { data: row, error: rowErr } = await supabase
            .from('user_e_invites')
            .select('id, user_id, price_inr, status, storage_path')
            .eq('id', user_e_invite_id)
            .single()

        if (rowErr || !row) {
            return NextResponse.json({ error: 'E-invite not found' }, { status: 404 })
        }
        if (row.user_id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const expectedPaise = Math.max(100, Math.round(Number(row.price_inr) * 100))
        if (Math.abs(rzpOrder.amount - expectedPaise) > 100) {
            return NextResponse.json({ error: 'Payment amount does not match invite price' }, { status: 400 })
        }

        const paidAt = new Date().toISOString()
        const { error: upErr } = await supabase
            .from('user_e_invites')
            .update({
                status: 'paid',
                razorpay_payment_id: String(razorpay_payment_id),
                razorpay_order_id: String(razorpay_order_id),
                paid_at: paidAt,
                updated_at: paidAt,
            })
            .eq('id', user_e_invite_id)

        if (upErr) {
            return NextResponse.json({ error: upErr.message || 'Could not update invite' }, { status: 500 })
        }

        return NextResponse.json({
            ok: true,
            user_e_invite_id: row.id,
            storage_path: row.storage_path,
            paid_at: paidAt,
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message || 'Verification failed' }, { status: 500 })
    }
}
