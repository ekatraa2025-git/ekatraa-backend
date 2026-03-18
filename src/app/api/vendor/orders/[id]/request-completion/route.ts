import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

function generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * POST /api/vendor/orders/[id]/request-completion
 * Vendor requests to mark order complete. Generates 6-digit OTP, stores it, and returns.
 * Customer fetches OTP via order detail API. Vendor then calls confirm-completion with the OTP.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { id: orderId } = await params
    if (!orderId) {
        return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, vendor_id, status, user_id, contact_mobile')
        .eq('id', orderId)
        .eq('vendor_id', auth.vendorId!)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if ((order.status as string) === 'completed') {
        return NextResponse.json({ error: 'Order is already completed' }, { status: 400 })
    }

    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    const { error: upsertErr } = await supabase
        .from('order_completion_otp')
        .upsert(
            { order_id: orderId, otp, expires_at: expiresAt.toISOString() },
            { onConflict: 'order_id' }
        )

    if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        message: 'OTP generated. Customer will receive it in the ekatraa app. Ask the customer for the OTP and enter it to confirm completion.',
    })
}
