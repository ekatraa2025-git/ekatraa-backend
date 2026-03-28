import { NextResponse } from 'next/server'
import { anthropicErrorToHttp } from '@/lib/claude-client'
import { generateBudgetNarrative, type NarrativeAllocationLine } from '@/lib/claude-narrative'

/**
 * POST /api/public/recommendations/narrative
 * Body: { occasion_name, budget_inr, guest_band?, city?, occasion_id?, allocation_lines: [{ category_id, name, percentage, allocated_inr }] }
 * Requires CLAUDE_API_KEY or ANTHROPIC_API_KEY. No substitute copy is returned on failure.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const occasion_name = typeof body.occasion_name === 'string' ? body.occasion_name.trim() : ''
        const budget_inr = Number(body.budget_inr)
        const guest_band =
            typeof body.guest_band === 'string' && body.guest_band.trim() ? body.guest_band.trim() : null
        const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim() : null
        const occasion_id =
            typeof body.occasion_id === 'string' && body.occasion_id.trim() ? body.occasion_id.trim() : null
        const lines = body.allocation_lines

        if (!occasion_name) {
            return NextResponse.json({ error: 'occasion_name is required' }, { status: 400 })
        }
        if (!Number.isFinite(budget_inr) || budget_inr <= 0) {
            return NextResponse.json({ error: 'budget_inr must be a positive number' }, { status: 400 })
        }
        if (!Array.isArray(lines) || lines.length === 0) {
            return NextResponse.json({ error: 'allocation_lines must be a non-empty array' }, { status: 400 })
        }

        const allocation_lines: NarrativeAllocationLine[] = []
        for (const row of lines) {
            if (!row || typeof row !== 'object') continue
            const r = row as Record<string, unknown>
            const category_id = typeof r.category_id === 'string' ? r.category_id : ''
            const name = typeof r.name === 'string' ? r.name : ''
            const percentage = Number(r.percentage)
            const allocated_inr = Number(r.allocated_inr)
            if (!category_id || !name || !Number.isFinite(percentage) || !Number.isFinite(allocated_inr)) {
                return NextResponse.json(
                    { error: 'Each allocation_lines item needs category_id, name, percentage, allocated_inr' },
                    { status: 400 }
                )
            }
            allocation_lines.push({ category_id, name, percentage, allocated_inr })
        }

        const { parsed, duration_ms } = await generateBudgetNarrative({
            occasion_name,
            budget_inr,
            guest_band,
            allocation_lines,
            city,
            occasion_id,
        })

        return NextResponse.json({
            narrative: parsed,
            ai_meta: { duration_ms, source: 'claude' },
        })
    } catch (e) {
        const { status, body } = anthropicErrorToHttp(e)
        return NextResponse.json(body, { status })
    }
}
