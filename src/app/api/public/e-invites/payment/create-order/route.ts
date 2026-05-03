import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { supabase } from '@/lib/supabase/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * POST /api/public/e-invites/payment/create-order
 * Body: { user_e_invite_id: string }
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
        const inviteId = String(body.user_e_invite_id || '').trim()
        if (!inviteId) {
            return NextResponse.json({ error: 'user_e_invite_id is required' }, { status: 400 })
        }

        const { data: row, error } = await supabase
            .from('user_e_invites')
            .select('id, user_id, price_inr, status')
            .eq('id', inviteId)
            .single()

        if (error || !row) {
            return NextResponse.json({ error: 'E-invite not found' }, { status: 404 })
        }
        if (row.user_id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        if (row.status === 'paid') {
            return NextResponse.json({ error: 'Already paid' }, { status: 400 })
        }
        if (row.status === 'cancelled') {
            return NextResponse.json({ error: 'Invite cancelled' }, { status: 400 })
        }

        const amountPaise = Math.max(100, Math.round(Number(row.price_inr) * 100))
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
        const order = await razorpay.orders.create({
            amount: amountPaise,
            currency: 'INR',
            receipt: `einv_${inviteId.slice(0, 8)}`,
            notes: {
                user_e_invite_id: inviteId,
                user_id: userId,
            },
        })

        await supabase
            .from('user_e_invites')
            .update({ razorpay_order_id: order.id, updated_at: new Date().toISOString() })
            .eq('id', inviteId)

        return NextResponse.json({
            key: keyId,
            amount: order.amount,
            currency: order.currency,
            razorpay_order_id: order.id,
            user_e_invite_id: inviteId,
            price_inr: row.price_inr,
        })
    } catch (e) {
        const err = e as Error & { error?: { description?: string } }
        const msg = err?.error?.description || err?.message || 'Could not create payment order'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
