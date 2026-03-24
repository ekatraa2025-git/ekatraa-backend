import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { budgetToInr, clampBudgetInr } from '@/lib/budget-mapping'
import {
    buildTiersForService,
    effectivePercentages,
    getMinTierPrice,
    normalizeWeightsForCategories,
    selectionNoteForService,
    type OfferableServiceRow,
} from '@/lib/recommendation-helpers'

function parseCategoryWeights(raw: string | null): Record<string, number> | null {
    if (!raw || !raw.trim()) return null
    try {
        const o = JSON.parse(raw) as unknown
        if (o && typeof o === 'object' && !Array.isArray(o)) {
            const out: Record<string, number> = {}
            for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
                const n = Number(v)
                if (!Number.isNaN(n)) out[k] = n
            }
            return out
        }
    } catch {
        /* invalid JSON */
    }
    return null
}

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

    let totalBudget = 0
    if (budgetInrRaw != null && String(budgetInrRaw).trim() !== '') {
        totalBudget = clampBudgetInr(Number(budgetInrRaw))
    } else if (budgetParam) {
        totalBudget = budgetToInr(budgetParam)
    }

    if (totalBudget <= 0) {
        return NextResponse.json(
            { error: 'Provide a valid budget string or budget_inr (INR)' },
            { status: 400 }
        )
    }

    const categoryWeights = parseCategoryWeights(weightsRaw)

    const { data: occasionRow } = await supabase
        .from('occasions')
        .select('id, name')
        .eq('id', occasionId)
        .maybeSingle()
    const occasionName = (occasionRow as { name?: string } | null)?.name ?? occasionId

    const { data: allocations, error: allocError } = await supabase
        .from('occasion_budget_allocations')
        .select('id, occasion_id, category_id, percentage, display_order')
        .eq('occasion_id', occasionId)
        .order('display_order', { ascending: true })

    if (allocError) {
        return NextResponse.json({ error: allocError.message }, { status: 500 })
    }

    const { data: serviceOccasionLinks, error: soError } = await supabase
        .from('service_occasions')
        .select('service_id')
        .eq('occasion_id', occasionId)

    if (soError) {
        return NextResponse.json({ error: soError.message }, { status: 500 })
    }

    const allowedServiceIds = new Set(
        (serviceOccasionLinks ?? []).map((r: { service_id: string }) => r.service_id)
    )

    type ServiceOut = {
        id: string
        name: string
        description: string | null
        image_url: string | null
        price_min: number | null
        price_max: number | null
        tiers: ReturnType<typeof buildTiersForService>
        selection_note: string
    }

    const categoriesResult: Array<{
        id: string
        name: string
        percentage: number
        allocated_budget: number
        services: ServiceOut[]
    }> = []

    if (allocations && allocations.length > 0) {
        const pctMap = effectivePercentages(
            allocations.map((a) => ({
                category_id: a.category_id,
                percentage: Number(a.percentage),
            })),
            categoryWeights
        )

        for (const alloc of allocations) {
            const effectivePct = pctMap.get(alloc.category_id) ?? Number(alloc.percentage)
            const allocatedBudget = totalBudget * (effectivePct / 100)

            const { data: cat } = await supabase
                .from('categories')
                .select('id, name')
                .eq('id', alloc.category_id)
                .single()

            const categoryName = (cat as { name?: string } | null)?.name ?? alloc.category_id

            const { data: services, error: svcError } = await supabase
                .from('offerable_services')
                .select(
                    'id, category_id, name, description, image_url, display_order, price_min, price_max, price_basic, price_classic_value, price_signature, price_prestige, price_royal, price_imperial'
                )
                .eq('category_id', alloc.category_id)
                .eq('is_active', true)
                .order('display_order', { ascending: true })

            if (svcError) {
                categoriesResult.push({
                    id: alloc.category_id,
                    name: categoryName,
                    percentage: effectivePct,
                    allocated_budget: allocatedBudget,
                    services: [],
                })
                continue
            }

            const eligible = (services ?? []).filter((s: OfferableServiceRow) => {
                if (!allowedServiceIds.has(s.id)) return false
                const minPrice = getMinTierPrice(s)
                return minPrice <= allocatedBudget
            })

            categoriesResult.push({
                id: alloc.category_id,
                name: categoryName,
                percentage: effectivePct,
                allocated_budget: allocatedBudget,
                services: eligible.map((s: OfferableServiceRow) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    image_url: s.image_url,
                    price_min: s.price_min,
                    price_max: s.price_max,
                    tiers: buildTiersForService(s, allocatedBudget),
                    selection_note: selectionNoteForService(s, allocatedBudget),
                })),
            })
        }
    } else {
        const { data: cats } = await supabase
            .from('occasion_categories')
            .select('category_id, display_order, categories(id, name)')
            .eq('occasion_id', occasionId)
            .order('display_order', { ascending: true })

        const categoryList = (cats ?? []).flatMap(
            (row: { category_id: string; categories: unknown }) => {
                const c = row.categories
                const arr = Array.isArray(c) ? c : c ? [c] : []
                return arr.map((cat: { id: string; name: string }) => ({
                    id: cat.id,
                    name: cat.name,
                }))
            }
        )

        const ids = categoryList.map((c) => c.id)
        const weightMap =
            categoryWeights && Object.keys(categoryWeights).length > 0
                ? normalizeWeightsForCategories(ids, categoryWeights)
                : null

        for (const cat of categoryList) {
            const effectivePct = weightMap?.get(cat.id) ?? 0
            const allocatedBudget = totalBudget * (effectivePct / 100)

            const { data: services, error: svcError } = await supabase
                .from('offerable_services')
                .select(
                    'id, category_id, name, description, image_url, display_order, price_min, price_max, price_basic, price_classic_value, price_signature, price_prestige, price_royal, price_imperial'
                )
                .eq('category_id', cat.id)
                .eq('is_active', true)
                .order('display_order', { ascending: true })

            if (svcError) {
                categoriesResult.push({
                    id: cat.id,
                    name: cat.name,
                    percentage: effectivePct,
                    allocated_budget: allocatedBudget,
                    services: [],
                })
                continue
            }

            const eligible = (services ?? []).filter((s: OfferableServiceRow) => {
                if (!allowedServiceIds.has(s.id)) return false
                if (allocatedBudget <= 0) return true
                const minPrice = getMinTierPrice(s)
                return minPrice <= allocatedBudget
            })

            categoriesResult.push({
                id: cat.id,
                name: cat.name,
                percentage: effectivePct,
                allocated_budget: allocatedBudget,
                services: eligible.map((s: OfferableServiceRow) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    image_url: s.image_url,
                    price_min: s.price_min,
                    price_max: s.price_max,
                    tiers: buildTiersForService(s, allocatedBudget),
                    selection_note: selectionNoteForService(s, allocatedBudget),
                })),
            })
        }
    }

    const allocation_summary = categoriesResult.map((c) => ({
        category_id: c.id,
        name: c.name,
        percentage: Math.round(c.percentage * 100) / 100,
        allocated_inr: Math.round(c.allocated_budget * 100) / 100,
        occasion_name: occasionName,
    }))

    return NextResponse.json({
        schema_version: 2,
        occasion_id: occasionId,
        occasion_name: occasionName,
        total_budget: totalBudget,
        allocation_summary,
        categories: categoriesResult,
    })
}
