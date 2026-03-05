import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Admin CRUD for new flow categories (table: categories).
 * Legacy vendor_categories remains at /api/admin/categories.
 */
export async function GET() {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { data, error } = await supabase
            .from('categories')
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
