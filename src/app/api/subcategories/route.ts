import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * @deprecated Use /api/public/categories and /api/public/services (new flow). Subcategory not in active model.
 * Public endpoint for mobile app to fetch subcategories (legacy).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')

    let query = supabase
        .from('service_subcategories')
        .select('id, name, category_id')
        .order('name', { ascending: true })

    if (categoryId) {
        query = query.eq('category_id', categoryId)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
}
