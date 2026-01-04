import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const allocated = searchParams.get('allocated')

    let query = supabase
        .from('bookings')
        .select('*')

    const { data: bookings, error } = await query.order('booking_date', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If fetching unallocated bookings, filter and return them directly without vendor info
    if (allocated === 'false') {
        const unallocatedBookings = (bookings || []).filter((booking: any) => 
            !booking.vendor_id || booking.vendor_id === null || booking.vendor_id === ''
        )
        return NextResponse.json(unallocatedBookings)
    }

    // Fetch vendor information for bookings that have vendor_id (only for regular listing)
    if (bookings && bookings.length > 0) {
        const vendorIds = bookings
            .map(b => b.vendor_id)
            .filter(id => id !== null && id !== undefined)
        
        let vendorsMap = new Map()
        if (vendorIds.length > 0) {
            const { data: vendors } = await supabase
                .from('vendors')
                .select('id, business_name')
                .in('id', vendorIds)
            
            vendorsMap = new Map(vendors?.map(v => [v.id, v.business_name]) || [])
        }

        const data = bookings.map(booking => ({
            ...booking,
            vendor_name: booking.vendor_id ? vendorsMap.get(booking.vendor_id) || null : null
        }))

        return NextResponse.json(data)
    }

    return NextResponse.json(bookings || [])
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        
        // Remove vendor_id if it's empty string or undefined to avoid NOT NULL constraint
        if (body.vendor_id === '' || body.vendor_id === undefined) {
            delete body.vendor_id
        }
        
        const { data, error } = await supabase
            .from('bookings')
            .insert([body])
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json(data, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
