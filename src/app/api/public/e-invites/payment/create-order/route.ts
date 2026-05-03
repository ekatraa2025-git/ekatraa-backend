import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase/server'

/**
 * POST /api/public/e-invites/payment/create-order
 * Body: { user_e_invite_id }
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
            return NextResponse.json({ error: 'user_e_invite_id required' }, { status: 400 })
        }

        const { data: inv, error: invErr } = await supabase
            .from('user_e_invites')
            .select('id, user_id, price_inr, payment_status')
            .eq('id', inviteId)
            .single()

        if (invErr || !inv) {
            return NextResponse.json({ error: 'E-invite not found' }, { status: 404 })
        }
        if (inv.user_id !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
        if (inv.payment_status === 'paid') {
            return NextResponse.json({ error: 'Already paid' }, { status: 400 })
        }

        const priceInr = Math.max(1, Math.round(Number(inv.price_inr || 0)))
        const amountInPaise = Math.max(100, priceInr * 100)

        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
        const rzOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `einv_${String(inviteId).slice(0, 8)}_${Date.now().toString(36)}`,
            notes: {
                type: 'e_invite',
                user_e_invite_id: inviteId,
                user_id: String(userId),
            },
        })

        await supabase
            .from('user_e_invites')
            .update({ razorpay_order_id: rzOrder.id })
            .eq('id', inviteId)
            .eq('user_id', userId)

        return NextResponse.json({
            razorpay_order_id: rzOrder.id,
            amount: amountInPaise,
            amount_inr: priceInr,
            key: keyId,
            user_e_invite_id: inviteId,
        })
    } catch (e) {
        const err = e as Error & { error?: { description?: string } }
        const msg = err?.error?.description || err?.message || String(e)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
