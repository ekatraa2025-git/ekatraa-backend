import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

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
        .select('id, user_id, vendor_id, total_amount, advance_amount')
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

        await supabase.from('order_status_history').insert({
            order_id: orderId,
            status: 'confirmed',
            note: `Quotation accepted. Vendor allocated. Balance payable: ₹${(Number(quotation.amount) - Number(order?.advance_amount || 0)).toLocaleString()}`,
        })
    }

    return NextResponse.json(updated)
}
