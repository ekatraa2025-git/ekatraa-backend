import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const vendorId = searchParams.get('vendor_id')

    let query = supabase
        .from('services')
        .select('*')

    if (vendorId) {
        query = query.eq('vendor_id', vendorId)
    }

    const { data: services, error } = await query.order('name', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch vendors to include vendor information
    const { data: vendors } = await supabase.from('vendors').select('id, business_name')
    const vendorsMap = new Map(vendors?.map(v => [v.id, v.business_name]) || [])

    const data = services.map(service => ({
        ...service,
        vendor: {
            id: service.vendor_id,
            business_name: service.vendor_id ? vendorsMap.get(service.vendor_id) : null
        }
    }))

    return NextResponse.json(data)
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        
        // Remove category if it's empty or undefined to avoid NOT NULL constraint
        if (body.category === '' || body.category === undefined) {
            delete body.category
        }
        
        // Remove price_amount if it's empty or undefined to avoid NOT NULL constraint
        if (body.price_amount === '' || body.price_amount === undefined || body.price_amount === null) {
            delete body.price_amount
        }
        
        const { data, error } = await supabase
            .from('services')
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
