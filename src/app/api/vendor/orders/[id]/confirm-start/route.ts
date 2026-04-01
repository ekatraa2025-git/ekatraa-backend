import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

/**
 * POST /api/vendor/orders/[id]/confirm-start
 * Vendor submits OTP from customer. If valid, order status becomes in_progress.
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

    const status = order.status as string
    if (status === 'cancelled' || status === 'completed') {
        return NextResponse.json({ error: 'Cannot start work for this order' }, { status: 400 })
    }
    if (status === 'in_progress') {
        return NextResponse.json({ error: 'Work has already started' }, { status: 400 })
    }
    if (status !== 'confirmed') {
        return NextResponse.json({ error: 'Order must be confirmed before starting work.' }, { status: 400 })
    }

    const { data: otpRow, error: otpErr } = await supabase
        .from('order_start_otp')
        .select('otp, expires_at')
        .eq('order_id', orderId)
        .single()

    if (otpErr || !otpRow) {
        return NextResponse.json({ error: 'No start OTP found. Request a start OTP first.' }, { status: 400 })
    }

    if (new Date(otpRow.expires_at) < new Date()) {
        await supabase.from('order_start_otp').delete().eq('order_id', orderId)
        return NextResponse.json({ error: 'OTP has expired. Request a new start OTP.' }, { status: 400 })
    }

    if (otpRow.otp !== otp) {
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }

    const { error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'in_progress' })
        .eq('id', orderId)

    if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    const { error: otpDeleteErr } = await supabase.from('order_start_otp').delete().eq('order_id', orderId)
    if (otpDeleteErr) {
        console.error('Failed to delete start OTP:', otpDeleteErr.message)
    }

    const { error: historyErr } = await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: 'in_progress',
        note: 'Work started. Start OTP verified by vendor.',
    })
    if (historyErr) {
        console.error('Failed to insert order status history:', historyErr.message)
    }

    return NextResponse.json({ success: true, status: 'in_progress' })
}
