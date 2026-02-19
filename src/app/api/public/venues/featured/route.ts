import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20)

    let query = supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .limit(limit * 2)

    if (city) {
        query = query.ilike('city', `%${city}%`)
    }

    const { data: rows, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const list = rows || []
    // Prefer featured first if is_featured exists
    const withFeatured = list.some((v: { is_featured?: boolean }) => v.is_featured === true)
    const sorted = withFeatured
        ? [...list].sort((a: { is_featured?: boolean; display_order?: number }, b: { is_featured?: boolean; display_order?: number }) => {
            if (a.is_featured && !b.is_featured) return -1
            if (!a.is_featured && b.is_featured) return 1
            return (a.display_order ?? 999) - (b.display_order ?? 999)
          })
        : list.slice(0, limit)
    const data = sorted.slice(0, limit)

    return NextResponse.json(data)
}
