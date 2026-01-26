import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    // Fetch vendor, booking, and service information
    let vendor = null
    let booking = null
    let service = null

    if (quotation.vendor_id) {
        const { data: vendorData } = await supabase
            .from('vendors')
            .select('id, business_name, email, phone, city, address, owner_name, category')
            .eq('id', quotation.vendor_id)
            .single()
        vendor = vendorData
    }

    if (quotation.booking_id) {
        const { data: bookingData, error: bookingError } = await supabase
            .from('bookings')
            .select('id, customer_name, customer_email, customer_phone, booking_date, booking_time, city, venue, details, status, service_id, vendor_id')
            .eq('id', quotation.booking_id)
            .single()
        
        if (bookingError) {
            console.error('[BOOKING FETCH ERROR]', bookingError, 'booking_id:', quotation.booking_id)
        }
        booking = bookingData

        // Also fetch service details if booking has a service_id
        if (bookingData?.service_id) {
            const { data: serviceData } = await supabase
                .from('services')
                .select('id, name, description, base_price, category')
                .eq('id', bookingData.service_id)
                .single()
            service = serviceData
        }
    }

    // If quotation has service_id directly
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
                        // If already a full URL with token, return as-is
                        if (url.startsWith('http') && url.includes('token=')) {
                            return url
                        }
                        // Extract filename from URL or path
                        let fileName = url
                        if (url.startsWith('http')) {
                            const urlMatch = url.match(/\/ekatraa2025\/([^/?]+)/)
                            if (urlMatch && urlMatch[1]) {
                                fileName = urlMatch[1]
                            } else {
                                fileName = url.split('/').pop()?.split('?')[0] || url
                            }
                        }
                        // Generate signed URL
                        const { data, error } = await supabase.storage
                            .from('ekatraa2025')
                            .createSignedUrl(fileName, 86400) // 24 hours
                        if (error) {
                            console.error('[SIGNED URL ERROR]', error, 'fileName:', fileName)
                            // Fallback to public URL
                            const { data: { publicUrl } } = supabase.storage
                                .from('ekatraa2025')
                                .getPublicUrl(fileName)
                            return publicUrl
                        }
                        return data.signedUrl
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
        booking,
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

        // Always recalculate expected total revenues (sum of all quotations)
        if (currentQuotation.vendor_id) {
            const { data: allQuotations } = await supabase
                .from('quotations')
                .select('amount')
                .eq('vendor_id', currentQuotation.vendor_id)

            const expectedRevenue = (allQuotations || []).reduce((sum, q) => {
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

