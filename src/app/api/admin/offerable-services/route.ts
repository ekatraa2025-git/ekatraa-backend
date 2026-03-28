import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Admin CRUD for offerable_services (new flow services).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')
    const specialCatalog = searchParams.get('special_catalog')

    let query = supabase
        .from('offerable_services')
        .select('*')
        .order('display_order', { ascending: true })

    if (categoryId) query = query.eq('category_id', categoryId)
    if (specialCatalog === '1' || specialCatalog === 'true') {
        query = query.eq('is_special_catalog', true)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { data, error } = await supabase
            .from('offerable_services')
            .insert([{ ...body, is_active: body.is_active !== false }])
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json(data, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
