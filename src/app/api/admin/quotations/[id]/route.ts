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

    // Fetch vendor and booking information
    let vendor = null
    let booking = null

    if (quotation.vendor_id) {
        const { data: vendorData } = await supabase
            .from('vendors')
            .select('id, business_name, email, phone, city, address, owner_name')
            .eq('id', quotation.vendor_id)
            .single()
        vendor = vendorData
    }

    if (quotation.booking_id) {
        const { data: bookingData } = await supabase
            .from('bookings')
            .select('id, customer_name, customer_email, customer_phone, booking_date, city, details, status')
            .eq('id', quotation.booking_id)
            .single()
        booking = bookingData
    }

    return NextResponse.json({
        ...quotation,
        vendor,
        booking
    })
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await req.json()
        const { data, error } = await supabase
            .from('quotations')
            .update(body)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

