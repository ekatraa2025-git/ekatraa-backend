import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    const { data: quotations, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch vendor and booking information manually
    if (quotations && quotations.length > 0) {
        const vendorIds = quotations.map(q => q.vendor_id).filter(id => id)
        const bookingIds = quotations.map(q => q.booking_id).filter(id => id)

        let vendorsMap = new Map()
        let bookingsMap = new Map()

        if (vendorIds.length > 0) {
            const { data: vendors } = await supabase
                .from('vendors')
                .select('id, business_name, email, phone, city')
                .in('id', vendorIds)
            vendorsMap = new Map(vendors?.map(v => [v.id, v]) || [])
        }

        if (bookingIds.length > 0) {
            const { data: bookings } = await supabase
                .from('bookings')
                .select('id, customer_name, customer_email, customer_phone, booking_date, city, details')
                .in('id', bookingIds)
            bookingsMap = new Map(bookings?.map(b => [b.id, b]) || [])
        }

        const data = quotations.map(quotation => ({
            ...quotation,
            vendor: quotation.vendor_id ? vendorsMap.get(quotation.vendor_id) || null : null,
            booking: quotation.booking_id ? bookingsMap.get(quotation.booking_id) || null : null
        }))

        return NextResponse.json(data)
    }

    return NextResponse.json(quotations || [])
}
