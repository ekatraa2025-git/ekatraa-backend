import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const subcategoryId = searchParams.get('subcategory_id')

    let query = supabase
        .from('service_stocks')
        .select('*, subcategory:service_subcategories(id, name, category_id)')
        .order('name', { ascending: true })

    if (subcategoryId) {
        query = query.eq('subcategory_id', subcategoryId)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { data, error } = await supabase
            .from('service_stocks')
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
