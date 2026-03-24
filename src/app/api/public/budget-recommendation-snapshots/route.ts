import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/public/budget-recommendation-snapshots
 * Persists form + recommendation (+ optional AI) for admin review.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const occasion_id = typeof body.occasion_id === 'string' ? body.occasion_id.trim() : ''
        const budget_inr = Number(body.budget_inr)
        const form_snapshot = body.form_snapshot
        const category_percentages = body.category_percentages
        const recommendation_payload = body.recommendation_payload

        if (!occasion_id) {
            return NextResponse.json({ error: 'occasion_id is required' }, { status: 400 })
        }
        if (!Number.isFinite(budget_inr) || budget_inr <= 0) {
            return NextResponse.json({ error: 'budget_inr must be a positive number' }, { status: 400 })
        }
        if (!form_snapshot || typeof form_snapshot !== 'object' || Array.isArray(form_snapshot)) {
            return NextResponse.json({ error: 'form_snapshot must be an object' }, { status: 400 })
        }
        if (!category_percentages || typeof category_percentages !== 'object' || Array.isArray(category_percentages)) {
            return NextResponse.json({ error: 'category_percentages must be an object' }, { status: 400 })
        }
        if (
            !recommendation_payload ||
            typeof recommendation_payload !== 'object' ||
            Array.isArray(recommendation_payload)
        ) {
            return NextResponse.json({ error: 'recommendation_payload must be an object' }, { status: 400 })
        }

        const row = {
            cart_id: body.cart_id ?? null,
            user_id: body.user_id ?? null,
            occasion_id,
            contact_name: body.contact_name ?? null,
            contact_mobile: body.contact_mobile ?? null,
            contact_email: body.contact_email ?? null,
            form_snapshot,
            budget_inr,
            category_percentages,
            recommendation_payload,
            ai_narrative: body.ai_narrative ?? null,
            ai_meta: body.ai_meta ?? null,
        }

        const { data, error } = await supabase.from('budget_recommendation_snapshots').insert([row]).select('id').single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json(data, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
