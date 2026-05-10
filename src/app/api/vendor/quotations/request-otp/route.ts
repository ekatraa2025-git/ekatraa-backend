import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest, isTeamMemberAssignedToOrder } from '@/lib/vendor-auth'
import { sendNotificationToVendor } from '@/lib/notifications'

function generateOtp(): string {
    return String(crypto.randomInt(100000, 1000000))
}

async function hasVendorAllocation(orderId: string, vendorId: string): Promise<boolean> {
    const { data: order } = await supabase
        .from('orders')
        .select('id, vendor_id')
        .eq('id', orderId)
        .maybeSingle()
    if (!order) return false
    if ((order as { vendor_id?: string }).vendor_id === vendorId) return true

    const { data: items } = await supabase.from('order_items').select('id').eq('order_id', orderId)
    const itemIds = (items ?? []).map((i: { id: string }) => i.id)
    if (!itemIds.length) return false

    const { data: alloc } = await supabase
        .from('order_item_allocations')
        .select('id')
        .eq('vendor_id', vendorId)
        .in('order_item_id', itemIds)
        .limit(1)
    return (alloc?.length ?? 0) > 0
}

export async function POST(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const orderId = String(body.order_id ?? '').trim()
    if (!orderId) {
        return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }

    if (!(await hasVendorAllocation(orderId, auth.vendorId))) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (!(await isTeamMemberAssignedToOrder(auth, orderId))) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const otpCode = generateOtp()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    const { data: challenge, error } = await supabase
        .from('vendor_quote_otp_challenges')
        .insert({
            vendor_id: auth.vendorId,
            order_id: orderId,
            team_member_id: auth.teamMemberId,
            otp_code: otpCode,
            status: 'pending',
            expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select('id, order_id, team_member_id, status, expires_at, created_at')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    sendNotificationToVendor({
        vendor_id: auth.vendorId,
        type: 'booking_update',
        title: 'Quotation approval OTP',
        message: `Share OTP ${otpCode} with your team to approve quotation submission for order ${orderId.slice(0, 8)}.`,
        data: { order_id: orderId, quote_otp_challenge_id: challenge.id, step: 'quotation_approval_otp' },
    }).catch(() => {
        /* non-fatal */
    })

    return NextResponse.json({
        success: true,
        challenge,
        message: 'Approval OTP sent to vendor notifications.',
    })
}
