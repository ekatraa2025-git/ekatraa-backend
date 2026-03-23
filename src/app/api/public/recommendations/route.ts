import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { budgetToInr } from '@/lib/budget-mapping'

type ServiceRow = {
    id: string
    category_id: string
    name: string
    description: string | null
    image_url: string | null
    display_order: number
    price_min: number | null
    price_max: number | null
    price_basic: number | null
    price_classic_value: number | null
    price_signature: number | null
    price_prestige: number | null
    price_royal: number | null
    price_imperial: number | null
}

function getMinPrice(s: ServiceRow): number {
    const vals = [
        s.price_min,
        s.price_basic,
        s.price_classic_value,
        s.price_signature,
        s.price_prestige,
        s.price_royal,
        s.price_imperial,
    ].filter((v): v is number => v != null && typeof v === 'number')
    return vals.length ? Math.min(...vals) : Infinity
}

/**
 * GET /api/public/recommendations?occasion_id=&budget=
 * Returns categories with allocated budget and services within budget.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const occasionId = searchParams.get('occasion_id')
    const budgetParam = searchParams.get('budget')

    if (!occasionId || !budgetParam) {
        return NextResponse.json(
            { error: 'occasion_id and budget are required' },
            { status: 400 }
        )
    }

    const totalBudget = budgetToInr(budgetParam)
    if (totalBudget <= 0) {
        return NextResponse.json(
            { error: 'Invalid budget value' },
            { status: 400 }
        )
    }

    const { data: allocations, error: allocError } = await supabase
        .from('occasion_budget_allocations')
        .select('id, occasion_id, category_id, percentage, display_order')
        .eq('occasion_id', occasionId)
        .order('display_order', { ascending: true })

    if (allocError) {
        return NextResponse.json({ error: allocError.message }, { status: 500 })
    }

    // Services linked to occasion
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

    const categoriesResult: Array<{
        id: string
        name: string
        percentage: number
        allocated_budget: number
        services: Array<{
            id: string
            name: string
            description: string | null
            image_url: string | null
            price_min: number | null
            price_max: number | null
        }>
    }> = []

    if (allocations && allocations.length > 0) {
        for (const alloc of allocations) {
            const allocatedBudget = totalBudget * (Number(alloc.percentage) / 100)

            const { data: cat } = await supabase
                .from('categories')
                .select('id, name')
                .eq('id', alloc.category_id)
                .single()

            const categoryName = (cat as { name?: string } | null)?.name ?? alloc.category_id

            const { data: services, error: svcError } = await supabase
                .from('offerable_services')
                .select('id, category_id, name, description, image_url, display_order, price_min, price_max, price_basic, price_classic_value, price_signature, price_prestige, price_royal, price_imperial')
                .eq('category_id', alloc.category_id)
                .eq('is_active', true)
                .order('display_order', { ascending: true })

            if (svcError) {
                categoriesResult.push({
                    id: alloc.category_id,
                    name: categoryName,
                    percentage: Number(alloc.percentage),
                    allocated_budget: allocatedBudget,
                    services: [],
                })
                continue
            }

            const eligible = (services ?? []).filter((s: ServiceRow) => {
                if (!allowedServiceIds.has(s.id)) return false
                const minPrice = getMinPrice(s)
                return minPrice <= allocatedBudget
            })

            categoriesResult.push({
                id: alloc.category_id,
                name: categoryName,
                percentage: Number(alloc.percentage),
                allocated_budget: allocatedBudget,
                services: eligible.map((s: ServiceRow) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    image_url: s.image_url,
                    price_min: s.price_min,
                    price_max: s.price_max,
                })),
            })
        }
    } else {
        const { data: cats } = await supabase
            .from('occasion_categories')
            .select('category_id, categories(id, name)')
            .eq('occasion_id', occasionId)
            .order('display_order', { ascending: true })

        const categoryList = (cats ?? []).flatMap((row: { categories: unknown }) =>
            Array.isArray(row.categories) ? row.categories : row.categories ? [row.categories] : []
        )

        for (const cat of categoryList as Array<{ id: string; name: string }>) {
            const { data: services, error: svcError } = await supabase
                .from('offerable_services')
                .select('id, category_id, name, description, image_url, display_order, price_min, price_max, price_basic, price_classic_value, price_signature, price_prestige, price_royal, price_imperial')
                .eq('category_id', cat.id)
                .eq('is_active', true)
                .order('display_order', { ascending: true })

            if (svcError) {
                categoriesResult.push({
                    id: cat.id,
                    name: cat.name,
                    percentage: 0,
                    allocated_budget: 0,
                    services: [],
                })
                continue
            }

            const eligible = (services ?? []).filter((s: ServiceRow) =>
                allowedServiceIds.has(s.id)
            )

            categoriesResult.push({
                id: cat.id,
                name: cat.name,
                percentage: 0,
                allocated_budget: 0,
                services: eligible.map((s: ServiceRow) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    image_url: s.image_url,
                    price_min: s.price_min,
                    price_max: s.price_max,
                })),
            })
        }
    }

    return NextResponse.json({
        total_budget: totalBudget,
        categories: categoriesResult,
    })
}
