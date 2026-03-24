import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/budget-recommendation-snapshots?limit=&offset=&q=
 * q matches contact_mobile or contact_name (ilike).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30))
    const offset = Math.max(0, Number(searchParams.get('offset')) || 0)
    const q = (searchParams.get('q') || '').trim()

    let query = supabase
        .from('budget_recommendation_snapshots')
        .select(
            'id, created_at, cart_id, user_id, occasion_id, contact_name, contact_mobile, contact_email, budget_inr, form_snapshot, category_percentages, recommendation_payload, ai_narrative, ai_meta',
            { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (q) {
        const esc = q.replace(/%/g, '\\%').replace(/_/g, '\\_')
        query = query.or(`contact_mobile.ilike.%${esc}%,contact_name.ilike.%${esc}%`)
    }

    const { data, error, count } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ items: data ?? [], total: count ?? 0, limit, offset })
}
