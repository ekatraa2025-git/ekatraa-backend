import crypto from 'crypto'
import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'
import { sendNotificationToVendor } from '@/lib/notifications'

function generateOtp(): string {
    return String(crypto.randomInt(100000, 1000000))
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
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const hasOrderLevelAllocation = (order as { vendor_id?: string }).vendor_id === auth.vendorId
    let hasItemAllocation = false
    if (!hasOrderLevelAllocation) {
        const { data: items } = await supabase.from('order_items').select('id').eq('order_id', orderId)
        const itemIds = (items ?? []).map((i: { id: string }) => i.id)
        if (itemIds.length > 0) {
            const { data: alloc } = await supabase
                .from('order_item_allocations')
                .select('id')
                .eq('vendor_id', auth.vendorId!)
                .in('order_item_id', itemIds)
                .limit(1)
            hasItemAllocation = (alloc?.length ?? 0) > 0
        }
    }
    if (!hasOrderLevelAllocation && !hasItemAllocation) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const status = order.status as string
    if (status === 'completed') {
        return NextResponse.json({ error: 'Order is already completed' }, { status: 400 })
    }
    if (status !== 'in_progress') {
        return NextResponse.json(
            {
                error:
                    'Work must be in progress before completion. Ask the customer for a start OTP first, then mark work as started.',
            },
            { status: 400 }
        )
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

    if (auth.vendorId) {
        sendNotificationToVendor({
            vendor_id: auth.vendorId,
            type: 'booking_update',
            title: 'Completion OTP generated',
            message: `Completion OTP generated for order ${orderId.slice(0, 8)}…`,
            data: { order_id: orderId, step: 'request_completion_otp' },
        }).catch(() => {
            /* non-fatal */
        })
    }

    return NextResponse.json({
        success: true,
        message: 'OTP generated. Customer will receive it in the ekatraa app. Ask the customer for the OTP and enter it to confirm completion.',
    })
}
