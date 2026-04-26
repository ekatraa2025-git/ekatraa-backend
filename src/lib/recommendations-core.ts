import type { SupabaseClient } from '@supabase/supabase-js'
import { budgetToInr, clampBudgetInr } from '@/lib/budget-mapping'
import {
    buildTiersForService,
    effectivePercentages,
    getMinTierPrice,
    normalizeWeightsForCategories,
    selectionNoteForService,
    type OfferableServiceRow,
} from '@/lib/recommendation-helpers'

export function parseCategoryWeights(raw: string | null): Record<string, number> | null {
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

export type RecommendationsCoreInput = {
    occasionId: string
    /** INR total budget */
    totalBudgetInr: number
    categoryWeights?: Record<string, number> | null
}

export type ServiceOut = {
    id: string
    name: string
    description: string | null
    image_url: string | null
    price_min: number | null
    price_max: number | null
    tiers: ReturnType<typeof buildTiersForService>
    selection_note: string
}

export type RecommendationsCoreSuccess = {
    ok: true
    occasion_id: string
    occasion_name: string
    total_budget: number
    allocation_summary: Array<{
        category_id: string
        name: string
        percentage: number
        allocated_inr: number
        occasion_name: string
    }>
    categories: Array<{
        id: string
        name: string
        percentage: number
        allocated_budget: number
        services: ServiceOut[]
    }>
}

export type RecommendationsCoreError = { ok: false; status: number; message: string }

export type RecommendationsCoreResult = RecommendationsCoreSuccess | RecommendationsCoreError

/**
 * Pure budget resolution for GET query params (budget string vs INR).
 */
export function resolveTotalBudgetInr(budgetParam: string | null, budgetInrRaw: string | null): number {
    if (budgetInrRaw != null && String(budgetInrRaw).trim() !== '') {
        return clampBudgetInr(Number(budgetInrRaw))
    }
    if (budgetParam) {
        return budgetToInr(budgetParam)
    }
    return 0
}

/**
 * Shared recommendation math for HTTP routes and Mastra tools.
 */
export async function getRecommendationsCore(
    supabase: SupabaseClient,
    input: RecommendationsCoreInput
): Promise<RecommendationsCoreResult> {
    const { occasionId, totalBudgetInr, categoryWeights } = input

    if (!occasionId?.trim()) {
        return { ok: false, status: 400, message: 'occasion_id is required' }
    }
    if (totalBudgetInr <= 0) {
        return {
            ok: false,
            status: 400,
            message: 'Provide a valid budget_inr or resolved INR total budget',
        }
    }

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
        return { ok: false, status: 500, message: allocError.message }
    }

    const { data: serviceOccasionLinks, error: soError } = await supabase
        .from('service_occasions')
        .select('service_id')
        .eq('occasion_id', occasionId)

    if (soError) {
        return { ok: false, status: 500, message: soError.message }
    }

    const allowedServiceIds = new Set(
        (serviceOccasionLinks ?? []).map((r: { service_id: string }) => r.service_id)
    )

    const categoriesResult: RecommendationsCoreSuccess['categories'] = []

    if (allocations && allocations.length > 0) {
        const pctMap = effectivePercentages(
            allocations.map((a) => ({
                category_id: a.category_id,
                percentage: Number(a.percentage),
            })),
            categoryWeights ?? null
        )

        for (const alloc of allocations) {
            const effectivePct = pctMap.get(alloc.category_id) ?? Number(alloc.percentage)
            const allocatedBudget = totalBudgetInr * (effectivePct / 100)

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
            const allocatedBudget = totalBudgetInr * (effectivePct / 100)

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

    return {
        ok: true,
        occasion_id: occasionId,
        occasion_name: occasionName,
        total_budget: totalBudgetInr,
        allocation_summary,
        categories: categoriesResult,
    }
}
