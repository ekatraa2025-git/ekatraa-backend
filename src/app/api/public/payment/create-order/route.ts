import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'

const ADVANCE_PERCENT = 20

/**
 * GET /api/public/payment/create-order - Health check (returns 405, use POST)
 */
export async function GET() {
    const configured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
    return NextResponse.json(
        { ok: true, razorpay_configured: configured, message: 'Use POST with { cart_id, user_id } to create order' },
        { status: 200 }
    )
}

/**
 * POST /api/public/payment/create-order
 * Creates Razorpay order for 20% advance payment. Body: { cart_id, user_id }
 */
export async function POST(req: Request) {
    try {
        const keyId = process.env.RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET
        if (!keyId || !keySecret) {
            return NextResponse.json({ error: 'Razorpay not configured' }, { status: 503 })
        }

        const body = await req.json()
        const { cart_id, user_id } = body

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

        const orderUser = user_id ?? cart.user_id
        if (!orderUser) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
        }

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

        const advanceAmount = Math.round((totalAmount * ADVANCE_PERCENT) / 100)
        const amountInPaise = advanceAmount * 100

        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
        const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `cart_${cart_id}`,
            notes: { cart_id, user_id: orderUser },
        })

        return NextResponse.json({
            razorpay_order_id: order.id,
            amount: amountInPaise,
            advance_amount: advanceAmount,
            total_amount: totalAmount,
            key: keyId,
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
