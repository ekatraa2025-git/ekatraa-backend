import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

/**
 * POST /api/vendor/quotations
 * Submit a quotation for an order allocated to the vendor.
 * Requires: Authorization: Bearer <supabase_access_token>
 * Body: { order_id, amount, service_type?, venue_address?, specifications?, quantity_requirements?, quality_standards?, delivery_terms?, payment_terms?, attachments?, valid_until?, confirmation_date?, quotation_submitted_at? }
 */
export async function POST(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const {
        order_id,
        service_type,
        amount,
        venue_address,
        specifications,
        quantity_requirements,
        quality_standards,
        delivery_terms,
        payment_terms,
        attachments,
        valid_until,
        confirmation_date,
        quotation_submitted_at,
    } = body

    if (!order_id || amount == null) {
        return NextResponse.json(
            { error: 'order_id and amount are required' },
            { status: 400 }
        )
    }

    const amt = parseFloat(String(amount)) || 0
    if (amt <= 0) {
        return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    // Verify order exists and is allocated to this vendor
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, vendor_id')
        .eq('id', order_id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.vendor_id !== auth.vendorId) {
        return NextResponse.json({ error: 'Order is not allocated to you' }, { status: 403 })
    }

    const { data: existingQuotation } = await supabase
        .from('quotations')
        .select('id')
        .eq('order_id', String(order_id))
        .eq('vendor_id', auth.vendorId)
        .maybeSingle()

    const { data: orderItems } = await supabase
        .from('order_items')
        .select('name')
        .eq('order_id', String(order_id))
        .limit(1)

    const resolvedServiceType = service_type
        ? String(service_type)
        : (orderItems?.[0]?.name || 'Order Service')

    const quotationData = {
        vendor_id: auth.vendorId,
        order_id,
        service_type: resolvedServiceType,
        amount: amt,
        venue_address: venue_address ? String(venue_address) : null,
        specifications: specifications ? String(specifications) : null,
        quantity_requirements: quantity_requirements ? String(quantity_requirements) : null,
        quality_standards: quality_standards ? String(quality_standards) : null,
        delivery_terms: delivery_terms ? String(delivery_terms) : null,
        payment_terms: payment_terms ? String(payment_terms) : null,
        attachments: attachments && typeof attachments === 'object' ? attachments : {},
        valid_until: valid_until ? new Date(String(valid_until)).toISOString() : null,
        confirmation_date: confirmation_date ? new Date(String(confirmation_date)).toISOString() : null,
        quotation_submitted_at: quotation_submitted_at ? new Date(String(quotation_submitted_at)).toISOString() : new Date().toISOString(),
        vendor_tc_accepted: true,
        customer_tc_accepted: false,
        status: 'pending',
    }

    const { data: quotation, error: writeError } = existingQuotation?.id
        ? await supabase
            .from('quotations')
            .update(quotationData)
            .eq('id', existingQuotation.id)
            .select()
            .single()
        : await supabase
            .from('quotations')
            .insert(quotationData)
            .select()
            .single()

    if (writeError) {
        return NextResponse.json({ error: writeError.message }, { status: 500 })
    }

    // Update vendor expected revenue
    try {
        const { data: allQuotations } = await supabase
            .from('quotations')
            .select('amount, status')
            .eq('vendor_id', auth.vendorId)

        const expectedRevenue = (allQuotations ?? []).reduce((sum: number, q: { amount?: number; status?: string }) => {
            if (q.status === 'rejected' || q.status === 'declined') return sum
            return sum + (parseFloat(String(q.amount || '0')) || 0)
        }, 0)

        await supabase
            .from('vendors')
            .update({ expected_total_revenues: expectedRevenue })
            .eq('id', auth.vendorId)
    } catch {
        // Non-fatal
    }

    return NextResponse.json(quotation, { status: existingQuotation?.id ? 200 : 201 })
}
