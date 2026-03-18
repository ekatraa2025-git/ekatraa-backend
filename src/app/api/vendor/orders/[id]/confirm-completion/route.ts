import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

/**
 * POST /api/vendor/orders/[id]/confirm-completion
 * Vendor submits OTP received from customer. If valid, order status is set to completed.
 * Body: { otp: string }
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

    const body = await req.json().catch(() => ({}))
    const otp = String(body?.otp ?? '').trim()

    if (!otp) {
        return NextResponse.json({ error: 'OTP is required' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, vendor_id, status')
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

    if ((order.status as string) === 'completed') {
        return NextResponse.json({ error: 'Order is already completed' }, { status: 400 })
    }

    const { data: otpRow, error: otpErr } = await supabase
        .from('order_completion_otp')
        .select('otp, expires_at')
        .eq('order_id', orderId)
        .single()

    if (otpErr || !otpRow) {
        return NextResponse.json({ error: 'No completion OTP found. Request completion first.' }, { status: 400 })
    }

    if (new Date(otpRow.expires_at) < new Date()) {
        await supabase.from('order_completion_otp').delete().eq('order_id', orderId)
        return NextResponse.json({ error: 'OTP has expired. Request a new completion OTP.' }, { status: 400 })
    }

    if (otpRow.otp !== otp) {
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }

    const { error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', orderId)

    if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    await supabase.from('order_completion_otp').delete().eq('order_id', orderId)

    await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: 'completed',
        note: 'Order completed. OTP verified by vendor.',
    })

    return NextResponse.json({ success: true, status: 'completed' })
}
