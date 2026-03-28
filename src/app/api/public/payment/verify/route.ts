import crypto from 'crypto'
import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
    fetchPlatformProtectionSettings,
    computeProtectionAmountInr,
    computeAdvanceInrFromBase,
} from '@/lib/booking-protection'

const ADVANCE_PERCENT = 20

/**
 * POST /api/public/payment/verify
 * Verifies Razorpay signature and creates order with advance payment. Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature, cart_id, user_id }
 */
export async function POST(req: Request) {
    try {
        const keySecret = process.env.RAZORPAY_KEY_SECRET
        if (!keySecret) {
            return NextResponse.json({ error: 'Razorpay not configured' }, { status: 503 })
        }

        const body = await req.json()
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, cart_id, user_id, booking_protection } = body
        const wantProtection = booking_protection === true

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !cart_id) {
            return NextResponse.json({ error: 'Missing payment or cart details' }, { status: 400 })
        }

        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex')

        if (expectedSignature !== razorpay_signature) {
            return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
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
            .select('service_id, quantity, unit_price, offerable_services(name)')
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

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([
                {
                    user_id: orderUser,
                    event_name: cart.event_name,
                    event_role: cart.event_role ?? null,
                    event_date: cart.event_date,
                    guest_count: cart.guest_count,
                    location_preference: cart.location_preference,
                    venue_preference: cart.venue_preference,
                    planned_budget: cart.planned_budget,
                    contact_name: cart.contact_name,
                    contact_mobile: cart.contact_mobile,
                    contact_email: cart.contact_email,
                    total_amount: totalAmount,
                    advance_amount: advanceAmount,
                    booking_protection: wantProtection,
                    protection_amount: protectionAmount,
                    advance_paid_at: new Date().toISOString(),
                    razorpay_payment_id: razorpay_payment_id,
                    razorpay_order_id: razorpay_order_id,
                    status: 'pending',
                },
            ])
            .select()
            .single()

        if (orderError) {
            return NextResponse.json({ error: orderError.message }, { status: 400 })
        }

        const orderItems = items.map(
            (i: { service_id: string; quantity: number; unit_price: number | null; offerable_services: unknown }) => {
                const name = i.offerable_services && typeof i.offerable_services === 'object' && !Array.isArray(i.offerable_services)
                    ? (i.offerable_services as { name?: string }).name
                    : null
                return {
                    order_id: order.id,
                    service_id: i.service_id,
                    name: name ?? null,
                    quantity: i.quantity,
                    unit_price: Number(i.unit_price || 0),
                }
            }
        )

        const { error: oiError } = await supabase.from('order_items').insert(orderItems)

        if (oiError) {
            return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 })
        }

        await supabase.from('order_status_history').insert([
            { order_id: order.id, status: 'pending', note: `Order created. Advance (${ADVANCE_PERCENT}%) paid via Razorpay.` },
        ])

        return NextResponse.json(order, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
