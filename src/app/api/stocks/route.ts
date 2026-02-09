import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Public endpoint for mobile app to fetch service stocks/items
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const subcategoryId = searchParams.get('subcategory_id')

    let query = supabase
        .from('service_stocks')
        .select('id, name, subcategory_id, price_basic, price_standard, price_premium')
        .order('name', { ascending: true })

    if (subcategoryId) {
        query = query.eq('subcategory_id', subcategoryId)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
}
