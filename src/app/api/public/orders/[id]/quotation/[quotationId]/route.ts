import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { sendNotificationToVendor } from '@/lib/notifications'

const ADVANCE_PERCENT = 20

type QuotationAction = 'accept' | 'reject'

function computeAdvanceFields(quoteAmount: number, advancePaid: number) {
    const suggestedAdvanceInr = Math.round(quoteAmount * (ADVANCE_PERCENT / 100))
    const requiresAdvancePayment = advancePaid < suggestedAdvanceInr
    return { requires_advance_payment: requiresAdvancePayment, suggested_advance_inr: suggestedAdvanceInr }
}

/**
 * PATCH /api/public/orders/[id]/quotation/[quotationId]
 * Customer accepts or rejects a vendor quotation.
 * Body: { action: 'accept' | 'reject' }
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
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const action = body.action as QuotationAction | undefined
    if (action !== 'accept' && action !== 'reject') {
        return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 })
    }

    const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, user_id, status, advance_amount, total_amount, vendor_id')
        .eq('id', orderId)
        .single()

    if (orderErr || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.user_id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: quotation, error: quotErr } = await supabase
        .from('quotations')
        .select('*')
        .eq('id', quotationId)
        .eq('order_id', orderId)
        .single()

    if (quotErr || !quotation) {
        return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    const currentStatus = String(quotation.status || '').toLowerCase()
    if (currentStatus === 'accepted' || currentStatus === 'rejected') {
        return NextResponse.json({ error: `Quotation already ${currentStatus}` }, { status: 400 })
    }

    if (action === 'reject') {
        const { data: updated, error: rejectErr } = await supabase
            .from('quotations')
            .update({ status: 'rejected' })
            .eq('id', quotationId)
            .select()
            .single()

        if (rejectErr) {
            return NextResponse.json({ error: rejectErr.message }, { status: 500 })
        }

        if (quotation.vendor_id) {
            sendNotificationToVendor({
                vendor_id: quotation.vendor_id,
                type: 'quotation',
                title: 'Quotation declined',
                message: 'The customer declined your quotation for this order.',
                data: { order_id: orderId, quotation_id: quotationId, status: 'rejected' },
            }).catch(() => {
                /* non-fatal */
            })
        }

        return NextResponse.json({ quotation: updated })
    }

    const { data: existingAccepted } = await supabase
        .from('quotations')
        .select('id')
        .eq('order_id', orderId)
        .eq('status', 'accepted')
        .neq('id', quotationId)
        .maybeSingle()

    if (existingAccepted) {
        return NextResponse.json({ error: 'Another quotation is already accepted for this order.' }, { status: 400 })
    }

    const quoteAmount = Number(quotation.amount || 0)
    if (quoteAmount <= 0) {
        return NextResponse.json({ error: 'Invalid quotation amount' }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const { data: acceptedQuote, error: acceptErr } = await supabase
        .from('quotations')
        .update({
            status: 'accepted',
            customer_tc_accepted: true,
            confirmation_date: nowIso,
        })
        .eq('id', quotationId)
        .select()
        .single()

    if (acceptErr) {
        return NextResponse.json({ error: acceptErr.message }, { status: 500 })
    }

    await supabase
        .from('quotations')
        .update({ status: 'rejected' })
        .eq('order_id', orderId)
        .neq('id', quotationId)
        .in('status', ['pending', 'submitted'])

    const orderUpdate: Record<string, unknown> = {
        vendor_id: quotation.vendor_id,
        total_amount: quoteAmount,
    }
    if (String(order.status || '').toLowerCase() === 'pending') {
        orderUpdate.status = 'confirmed'
    }

    const { data: updatedOrder, error: orderUpdateErr } = await supabase
        .from('orders')
        .update(orderUpdate)
        .eq('id', orderId)
        .select()
        .single()

    if (orderUpdateErr) {
        return NextResponse.json({ error: orderUpdateErr.message }, { status: 500 })
    }

    if (orderUpdate.status === 'confirmed') {
        await supabase.from('order_status_history').insert([
            {
                order_id: orderId,
                status: 'confirmed',
                note: `Customer accepted vendor quotation (₹${quoteAmount.toLocaleString('en-IN')}).`,
            },
        ])
    }

    if (quotation.vendor_id) {
        const { data: vendorData } = await supabase
            .from('vendors')
            .select('real_revenue_earned')
            .eq('id', quotation.vendor_id)
            .single()

        const currentRealRevenue = parseFloat(String(vendorData?.real_revenue_earned || '0')) || 0
        await supabase
            .from('vendors')
            .update({ real_revenue_earned: currentRealRevenue + quoteAmount })
            .eq('id', quotation.vendor_id)

        sendNotificationToVendor({
            vendor_id: quotation.vendor_id,
            type: 'quotation',
            title: 'Quotation accepted',
            message: `Your quotation of ₹${quoteAmount.toLocaleString('en-IN')} was accepted by the customer.`,
            data: { order_id: orderId, quotation_id: quotationId, status: 'accepted' },
        }).catch(() => {
            /* non-fatal */
        })
    }

    const advancePaid = Number(updatedOrder?.advance_amount || order.advance_amount || 0)
    const advanceFields = computeAdvanceFields(quoteAmount, advancePaid)

    return NextResponse.json({
        quotation: acceptedQuote,
        order: {
            ...updatedOrder,
            ...advanceFields,
        },
    })
}
