import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { sendNotificationToVendor, sendNotificationToUser } from '@/lib/notifications'
import {
    fetchPlatformProtectionSettings,
    computeProtectionAmountInr,
    computeAdvanceInrFromBase,
} from '@/lib/booking-protection'

/**
 * PATCH /api/public/orders/[id]/quotation/[quotationId]
 * Accept or reject a quotation. Body: { action: 'accept' | 'reject' }
 * User must own the order (user_id match).
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string; quotationId: string }> }
) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { id: orderId, quotationId } = await params
    if (!orderId || !quotationId) {
        return NextResponse.json({ error: 'Order id and quotation id required' }, { status: 400 })
    }

    let body: { action?: string }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const action = body?.action
    if (action !== 'accept' && action !== 'reject') {
        return NextResponse.json({ error: 'action must be "accept" or "reject"' }, { status: 400 })
    }

    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select(
            'id, user_id, vendor_id, total_amount, advance_amount, booking_protection, protection_amount, contact_name'
        )
        .eq('id', orderId)
        .single()

    if (orderErr || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.user_id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: quotation, error: quoteErr } = await supabase
        .from('quotations')
        .select('id, order_id, vendor_id, amount, status')
        .eq('id', quotationId)
        .eq('order_id', orderId)
        .single()

    if (quoteErr || !quotation) {
        return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected'

    const { data: updated, error: updateErr } = await supabase
        .from('quotations')
        .update({ status: newStatus })
        .eq('id', quotationId)
        .select()
        .single()

    if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    if (action === 'accept') {
        await supabase
            .from('orders')
            .update({ vendor_id: quotation.vendor_id, status: 'confirmed' })
            .eq('id', orderId)

        const balanceNote = `Quotation accepted. Vendor allocated. Balance payable: ₹${(Number(quotation.amount) - Number(order?.advance_amount || 0)).toLocaleString()}`
        await supabase.from('order_status_history').insert({
            order_id: orderId,
            status: 'confirmed',
            note: balanceNote,
        })

        const settings = await fetchPlatformProtectionSettings()
        const totalAmt = Number(order.total_amount ?? 0)
        const prot = computeProtectionAmountInr(
            totalAmt,
            settings,
            order.booking_protection === true
        )
        const suggestedAdvance = computeAdvanceInrFromBase(totalAmt, prot, 20)
        const advancePaid = Number(order.advance_amount || 0)
        const needsAdvancePayment = advancePaid <= 0 && suggestedAdvance > 0

        try {
            await sendNotificationToVendor({
                vendor_id: quotation.vendor_id,
                type: 'quotation',
                title: 'Quotation accepted',
                message: `The customer accepted your quotation for order ${orderId.slice(0, 8)}…${needsAdvancePayment ? ' Awaiting customer advance payment.' : ''}`,
                data: { order_id: orderId, quotation_id: quotationId, action: 'accepted' },
            })
        } catch {
            /* non-fatal */
        }
        try {
            await sendNotificationToUser({
                user_id: userId,
                type: 'quotation',
                title: 'Quotation accepted',
                message: needsAdvancePayment
                    ? `Please complete your 20% advance (₹${Math.round(suggestedAdvance).toLocaleString('en-IN')}) to proceed.`
                    : 'Your booking is confirmed with the vendor.',
                data: {
                    order_id: orderId,
                    quotation_id: quotationId,
                    requires_advance_payment: needsAdvancePayment,
                    suggested_advance_inr: suggestedAdvance,
                },
            })
        } catch {
            /* non-fatal */
        }

        return NextResponse.json({
            ...updated,
            order: {
                requires_advance_payment: needsAdvancePayment,
                suggested_advance_inr: suggestedAdvance,
                advance_paid_inr: advancePaid,
            },
        })
    }

    if (action === 'reject') {
        try {
            await sendNotificationToVendor({
                vendor_id: quotation.vendor_id,
                type: 'quotation',
                title: 'Quotation declined',
                message: `The customer declined your quotation for order ${orderId.slice(0, 8)}…`,
                data: { order_id: orderId, quotation_id: quotationId, action: 'rejected' },
            })
        } catch {
            /* non-fatal */
        }
    }

    return NextResponse.json(updated)
}
