import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractCityFromAddress } from '@/utils/addressParser'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let query = supabase
        .from('vendors')
        .select('*')

    if (status) {
        query = query.eq('status', status)
    }

    const { data: vendors, error } = await query.order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch categories to manually join (workaround for missing DB relationship)
    const { data: categories } = await supabase.from('vendor_categories').select('id, name')

    const categoriesMap = new Map(categories?.map(c => [c.id, c.name]) || [])

    const data = vendors.map(vendor => ({
        ...vendor,
        vendor_categories: {
            name: vendor.category_id ? categoriesMap.get(vendor.category_id) : null
        }
    }))

    return NextResponse.json(data)
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        
        // Auto-extract city from address if city is not provided but address is
        if (body.address && !body.city) {
            const extractedCity = extractCityFromAddress(body.address)
            if (extractedCity) {
                body.city = extractedCity
            }
        }
        
        const { data, error } = await supabase
            .from('vendors')
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
