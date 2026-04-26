import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
    getRecommendationsCore,
    parseCategoryWeights,
    resolveTotalBudgetInr,
} from '@/lib/recommendations-core'

/**
 * GET /api/public/recommendations?occasion_id=&budget= | budget_inr=
 * Optional: category_weights= URL-encoded JSON object { category_id: percentage, ... }
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const occasionId = searchParams.get('occasion_id')
    const budgetParam = searchParams.get('budget')
    const budgetInrRaw = searchParams.get('budget_inr')
    const weightsRaw = searchParams.get('category_weights')

    if (!occasionId) {
        return NextResponse.json({ error: 'occasion_id is required' }, { status: 400 })
    }

    const totalBudget = resolveTotalBudgetInr(budgetParam, budgetInrRaw)

    if (totalBudget <= 0) {
        return NextResponse.json(
            { error: 'Provide a valid budget string or budget_inr (INR)' },
            { status: 400 }
        )
    }

    const categoryWeights = parseCategoryWeights(weightsRaw)

    const result = await getRecommendationsCore(supabase, {
        occasionId,
        totalBudgetInr: totalBudget,
        categoryWeights,
    })

    if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: result.status })
    }

    return NextResponse.json({
        schema_version: 2,
        occasion_id: result.occasion_id,
        occasion_name: result.occasion_name,
        total_budget: result.total_budget,
        allocation_summary: result.allocation_summary,
        categories: result.categories,
    })
}
