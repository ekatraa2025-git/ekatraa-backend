import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Admin CRUD for occasion_categories (many-to-many).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const occasionId = searchParams.get('occasion_id')
    const categoryId = searchParams.get('category_id')

    let query = supabase
        .from('occasion_categories')
        .select('*, occasions(id, name), categories(id, name)')
        .order('occasion_id')

    if (occasionId) query = query.eq('occasion_id', occasionId)
    if (categoryId) query = query.eq('category_id', categoryId)

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { occasion_id, category_id, display_order } = body
        if (!occasion_id || !category_id) {
            return NextResponse.json(
                { error: 'occasion_id and category_id required' },
                { status: 400 }
            )
        }
        const { data, error } = await supabase
            .from('occasion_categories')
            .insert([{ occasion_id, category_id, display_order: display_order ?? 0 }])
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

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url)
    const occasionId = searchParams.get('occasion_id')
    const categoryId = searchParams.get('category_id')
    if (!occasionId || !categoryId) {
        return NextResponse.json(
            { error: 'occasion_id and category_id required' },
            { status: 400 }
        )
    }
    const { error } = await supabase
        .from('occasion_categories')
        .delete()
        .eq('occasion_id', occasionId)
        .eq('category_id', categoryId)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ deleted: true })
}
