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
            .select('category_id, display_order, categories(id, name, icon_url, video_url, display_order)')
            .eq('occasion_id', occasionId)
            .order('display_order', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        type CatRow = { display_order: number | null; categories: unknown }
        const list = (data ?? [])
            .map((row: CatRow) => {
                const c = row.categories
                const cat = Array.isArray(c) ? c[0] : c
                if (!cat || typeof cat !== 'object') return null
                const order = Number(row.display_order) || 0
                return { ...(cat as Record<string, unknown>), _occCatOrder: order }
            })
            .filter((x): x is Record<string, unknown> & { _occCatOrder: number } => x != null)
            .sort((a, b) => a._occCatOrder - b._occCatOrder)
            .map(({ _occCatOrder: _removed, ...rest }) => rest)
        return NextResponse.json(list)
    }

    const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon_url, video_url, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
}
