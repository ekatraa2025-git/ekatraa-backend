import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/occasion-budget-allocations?occasion_id=
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const occasionId = searchParams.get('occasion_id')

    if (!occasionId) {
        return NextResponse.json(
            { error: 'occasion_id is required' },
            { status: 400 }
        )
    }

    const { data, error } = await supabase
        .from('occasion_budget_allocations')
        .select('id, occasion_id, category_id, percentage, display_order, created_at')
        .eq('occasion_id', occasionId)
        .order('display_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
}

/**
 * POST /api/admin/occasion-budget-allocations
 * Bulk upsert: body = { occasion_id, allocations: [{ category_id, percentage, display_order }] }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { occasion_id, allocations } = body

        if (!occasion_id || !Array.isArray(allocations)) {
            return NextResponse.json(
                { error: 'occasion_id and allocations array required' },
                { status: 400 }
            )
        }

        for (const a of allocations) {
            if (a.category_id == null || a.percentage == null) {
                return NextResponse.json(
                    { error: 'Each allocation must have category_id and percentage' },
                    { status: 400 }
                )
            }
        }

        const { error: delError } = await supabase
            .from('occasion_budget_allocations')
            .delete()
            .eq('occasion_id', occasion_id)

        if (delError) {
            return NextResponse.json({ error: delError.message }, { status: 400 })
        }

        if (allocations.length === 0) {
            return NextResponse.json({ saved: true, count: 0 })
        }

        const rows = allocations.map((a: { category_id: string; percentage: number; display_order?: number }, i: number) => ({
            occasion_id,
            category_id: a.category_id,
            percentage: Number(a.percentage),
            display_order: a.display_order ?? i,
        }))

        const { data: inserted, error: insError } = await supabase
            .from('occasion_budget_allocations')
            .insert(rows)
            .select()

        if (insError) {
            return NextResponse.json({ error: insError.message }, { status: 400 })
        }

        return NextResponse.json({ saved: true, count: inserted?.length ?? 0, data: inserted }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
