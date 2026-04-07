import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'
import { sendNotificationToVendor } from '@/lib/notifications'

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { data: quotation, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Fetch vendor, order, and service information
    let vendor = null
    let order = null
    let service = null

    if (quotation.vendor_id) {
        const { data: vendorData } = await supabase
            .from('vendors')
            .select('id, business_name, email, phone, city, address, owner_name, category')
            .eq('id', quotation.vendor_id)
            .single()
        vendor = vendorData
    }

    if (quotation.order_id) {
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('id, contact_name, contact_email, contact_mobile, event_date, location_preference, venue_preference, event_name, status, vendor_id')
            .eq('id', quotation.order_id)
            .single()

        if (orderError) {
            console.error('[ORDER FETCH ERROR]', orderError, 'order_id:', quotation.order_id)
        }
        order = orderData

        if (orderData?.id) {
            const { data: items } = await supabase
                .from('order_items')
                .select('service_id, name')
                .eq('order_id', orderData.id)
                .limit(1)
            const firstItem = items?.[0]
            if (firstItem?.service_id) {
                const { data: serviceData } = await supabase
                    .from('services')
                    .select('id, name, description, base_price, category')
                    .eq('id', firstItem.service_id)
                    .single()
                service = serviceData
            }
            if (!service && firstItem?.name) {
                service = { id: null, name: firstItem.name, description: null, base_price: null, category: null }
            }
        }
    }

    if (quotation.service_id && !service) {
        const { data: serviceData } = await supabase
            .from('services')
            .select('id, name, description, base_price, category')
            .eq('id', quotation.service_id)
            .single()
        service = serviceData
    }

    // Generate signed URLs for attachments
    let attachmentsWithSignedUrls = quotation.attachments
    if (quotation.attachments && typeof quotation.attachments === 'object') {
        attachmentsWithSignedUrls = {}
        for (const [category, urls] of Object.entries(quotation.attachments)) {
            if (Array.isArray(urls)) {
                const signedUrls = await Promise.all(
                    urls.map(async (url: string) => {
                        const signed = await signedUrlForStorageRef(url)
                        return signed ?? url
                    })
                )
                attachmentsWithSignedUrls[category] = signedUrls
            }
        }
    }

    return NextResponse.json({
        ...quotation,
        attachments: attachmentsWithSignedUrls,
        vendor,
        order,
        service
    })
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await req.json()

        // Get current quotation to check vendor_id and amount
        const { data: currentQuotation } = await supabase
            .from('quotations')
            .select('vendor_id, amount, status')
            .eq('id', id)
            .single()

        if (!currentQuotation) {
            return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
        }

        // Update quotation
        const { data, error } = await supabase
            .from('quotations')
            .update(body)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        if (body.status && body.status !== currentQuotation.status && currentQuotation.vendor_id) {
            sendNotificationToVendor({
                vendor_id: currentQuotation.vendor_id,
                type: 'quotation',
                title: `Quotation ${String(body.status)}`,
                message: `Your quotation status changed from ${currentQuotation.status} to ${String(body.status)}.`,
                data: { quotation_id: id, previous_status: currentQuotation.status, new_status: body.status },
            }).catch(() => {
                /* non-fatal */
            })
        }

        // If status changed to 'accepted', update vendor revenue
        if (body.status === 'accepted' && currentQuotation.status !== 'accepted' && currentQuotation.vendor_id) {
            const quotationAmount = parseFloat(data.amount || '0') || 0

            // Get current vendor revenue
            const { data: vendorData } = await supabase
                .from('vendors')
                .select('real_revenue_earned')
                .eq('id', currentQuotation.vendor_id)
                .single()

            const currentRealRevenue = parseFloat(vendorData?.real_revenue_earned || '0') || 0
            const newRealRevenue = currentRealRevenue + quotationAmount

            // Update vendor real revenue
            await supabase
                .from('vendors')
                .update({ real_revenue_earned: newRealRevenue })
                .eq('id', currentQuotation.vendor_id)
        }

        // Always recalculate expected total revenues (sum of all quotations, excluding rejected)
        if (currentQuotation.vendor_id) {
            const { data: allQuotations } = await supabase
                .from('quotations')
                .select('amount, status')
                .eq('vendor_id', currentQuotation.vendor_id)

            const expectedRevenue = (allQuotations || []).reduce((sum, q) => {
                // Exclude rejected quotations from expected revenue
                if (q.status === 'rejected' || q.status === 'declined') {
                    return sum
                }
                return sum + (parseFloat(q.amount || '0') || 0)
            }, 0)

            await supabase
                .from('vendors')
                .update({ expected_total_revenues: expectedRevenue })
                .eq('id', currentQuotation.vendor_id)
        }

        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Quotation id required' }, { status: 400 })
    }

    const { data: quotation, error: fetchError } = await supabase
        .from('quotations')
        .select('id, vendor_id')
        .eq('id', id)
        .single()

    if (fetchError || !quotation) {
        return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
        .from('quotations')
        .delete()
        .eq('id', id)

    if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Recalculate vendor expected revenue
    if (quotation.vendor_id) {
        try {
            const { data: allQuotations } = await supabase
                .from('quotations')
                .select('amount, status')
                .eq('vendor_id', quotation.vendor_id)

            const expectedRevenue = (allQuotations ?? []).reduce((sum: number, q: { amount?: number; status?: string }) => {
                if (q.status === 'rejected' || q.status === 'declined') return sum
                return sum + (parseFloat(String(q.amount || '0')) || 0)
            }, 0)

            await supabase
                .from('vendors')
                .update({ expected_total_revenues: expectedRevenue })
                .eq('id', quotation.vendor_id)
        } catch {
            // Non-fatal
        }
    }

    return NextResponse.json({ success: true })
}

