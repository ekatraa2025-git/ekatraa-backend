import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * GET /api/public/budget-recommendation-snapshots/:id
 * Full snapshot for the signed-in owner (budget, categories, AI narrative).
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId, error: authErr } = await getEndUserIdFromRequest(req)
    if (authErr) return authErr

    const { id } = await params
    const { data, error } = await supabase
        .from('budget_recommendation_snapshots')
        .select(
            'id, created_at, cart_id, user_id, occasion_id, contact_name, contact_mobile, contact_email, budget_inr, form_snapshot, category_percentages, recommendation_payload, ai_narrative, ai_meta'
        )
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(data)
}
