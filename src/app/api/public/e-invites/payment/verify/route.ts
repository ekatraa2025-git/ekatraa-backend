import crypto from 'crypto'
import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

/**
 * POST /api/public/e-invites/payment/verify
 * Body: { user_e_invite_id, razorpay_payment_id, razorpay_order_id, razorpay_signature, user_id }
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
        const {
            user_e_invite_id: inviteIdRaw,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            user_id: bodyUserId,
        } = body

        const inviteId = String(inviteIdRaw || '').trim()
        if (!inviteId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return NextResponse.json(
                { error: 'user_e_invite_id, razorpay_payment_id, razorpay_order_id, razorpay_signature required' },
                { status: 400 }
            )
        }

        if (String(bodyUserId || '') !== String(userId)) {
            return NextResponse.json({ error: 'user_id mismatch' }, { status: 403 })
        }

        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex')
        if (expectedSignature !== razorpay_signature) {
            return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
        }

        const { data: inv, error: invErr } = await supabase
            .from('user_e_invites')
            .select('id, user_id, price_inr, payment_status, storage_path, razorpay_order_id')
            .eq('id', inviteId)
            .single()

        if (invErr || !inv) {
            return NextResponse.json({ error: 'E-invite not found' }, { status: 404 })
        }
        if (inv.user_id !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
        if (inv.payment_status === 'paid') {
            const downloadUrl = await signedUrlForStorageRef(inv.storage_path)
            return NextResponse.json({
                ok: true,
                user_e_invite_id: inv.id,
                payment_status: 'paid',
                download_url: downloadUrl,
            })
        }

        if (String(inv.razorpay_order_id || '') !== String(razorpay_order_id)) {
            return NextResponse.json({ error: 'Razorpay order mismatch' }, { status: 400 })
        }

        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
        let rzpOrder: { amount?: number; amount_paid?: number; notes?: Record<string, string> }
        try {
            rzpOrder = (await razorpay.orders.fetch(razorpay_order_id)) as typeof rzpOrder
        } catch {
            return NextResponse.json({ error: 'Could not fetch Razorpay order' }, { status: 400 })
        }

        const noteId = String(rzpOrder?.notes?.user_e_invite_id || '')
        const noteUser = String(rzpOrder?.notes?.user_id || '')
        if (noteId !== inviteId || noteUser !== String(userId)) {
            return NextResponse.json({ error: 'Razorpay order notes mismatch' }, { status: 400 })
        }

        const expectedPaise = Math.max(100, Math.round(Number(inv.price_inr || 0)) * 100)
        const orderAmount = Number(rzpOrder.amount ?? 0)
        const paidPaise = Number(rzpOrder.amount_paid ?? orderAmount)
        const charged = paidPaise > 0 ? paidPaise : orderAmount
        if (Math.abs(charged - expectedPaise) > 100) {
            return NextResponse.json({ error: 'Paid amount does not match e-invite price' }, { status: 400 })
        }

        const paidAt = new Date().toISOString()
        const { error: upErr } = await supabase
            .from('user_e_invites')
            .update({
                payment_status: 'paid',
                paid_at: paidAt,
                razorpay_payment_id: String(razorpay_payment_id),
            })
            .eq('id', inviteId)
            .eq('user_id', userId)

        if (upErr) {
            return NextResponse.json({ error: upErr.message }, { status: 500 })
        }

        const downloadUrl = await signedUrlForStorageRef(inv.storage_path)

        return NextResponse.json({
            ok: true,
            user_e_invite_id: inviteId,
            payment_status: 'paid',
            download_url: downloadUrl,
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message || String(e) }, { status: 500 })
    }
}
