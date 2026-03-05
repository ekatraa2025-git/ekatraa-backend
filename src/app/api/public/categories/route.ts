import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/categories?occasion_id=
 * Returns categories for the new flow, optionally filtered by occasion (via occasion_categories).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const occasionId = searchParams.get('occasion_id')

    if (occasionId) {
        const { data, error } = await supabase
            .from('occasion_categories')
            .select('category_id, categories(id, name, icon_url, display_order)')
            .eq('occasion_id', occasionId)
            .order('display_order', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        const list = (data ?? []).flatMap((row: { categories: unknown }) =>
            Array.isArray(row.categories) ? row.categories : row.categories ? [row.categories] : []
        )
        return NextResponse.json(list)
    }

    const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon_url, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
}
