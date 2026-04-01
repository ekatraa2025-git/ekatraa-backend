import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import {
    fetchPlatformProtectionSettings,
    computeProtectionAmountInr,
    computeAdvanceInrFromBase,
} from '@/lib/booking-protection'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

const ADVANCE_PERCENT = 20

/**
 * GET /api/public/payment/create-order - Health check (returns 405, use POST)
 */
export async function GET() {
    const configured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
    return NextResponse.json(
        { ok: true, razorpay_configured: configured, message: 'Use POST with { cart_id } to create order' },
        { status: 200 }
    )
}

/**
 * POST /api/public/payment/create-order
 * Creates Razorpay order for 20% advance payment. Body: { cart_id }
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

        const body = await req.json()
        const { cart_id, booking_protection } = body
        const wantProtection = booking_protection === true

        if (!cart_id) {
            return NextResponse.json({ error: 'cart_id is required' }, { status: 400 })
        }

        const { data: cart, error: cartError } = await supabase
            .from('carts')
            .select('*')
            .eq('id', cart_id)
            .single()

        if (cartError || !cart) {
            return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
        }

        // Verify the cart belongs to the authenticated user
        if (cart.user_id && cart.user_id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const orderUser = userId

        const { data: items, error: itemsError } = await supabase
            .from('cart_items')
            .select('quantity, unit_price')
            .eq('cart_id', cart_id)

        if (itemsError || !items?.length) {
            return NextResponse.json({ error: 'Cart has no items' }, { status: 400 })
        }

        const totalAmount = items.reduce(
            (sum: number, i: { quantity: number; unit_price: number | null }) =>
                sum + (Number(i.quantity) * Number(i.unit_price || 0)),
            0
        )

        const settings = await fetchPlatformProtectionSettings()
        const protectionAmount = computeProtectionAmountInr(totalAmount, settings, wantProtection)
        const advanceAmount = computeAdvanceInrFromBase(totalAmount, protectionAmount, ADVANCE_PERCENT)
        const amountInPaise = Math.max(advanceAmount * 100, 100)

        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
        const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `cart_${String(cart_id).slice(-8)}_${Date.now().toString(36)}`,
            notes: { cart_id: String(cart_id), user_id: String(orderUser) },
        })

        return NextResponse.json({
            razorpay_order_id: order.id,
            amount: amountInPaise,
            advance_amount: advanceAmount,
            total_amount: totalAmount,
            protection_amount: protectionAmount,
            booking_protection: wantProtection,
            key: keyId,
        })
    } catch (e) {
        const err = e as Error & { error?: { description?: string }; statusCode?: number }
        const msg = err?.error?.description || err?.message || String(e)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
