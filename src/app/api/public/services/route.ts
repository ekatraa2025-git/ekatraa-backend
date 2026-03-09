import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/services
 * New contract: ?occasion_id=&category_id=&city=&search=
 * Legacy: ?eventType= or ?event_type= (app_service_catalog fallback)
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const occasionId = searchParams.get('occasion_id')
    const categoryId = searchParams.get('category_id')
    const city = searchParams.get('city')
    const search = searchParams.get('search')
    const eventType = searchParams.get('eventType') || searchParams.get('event_type')

    const useNewModel = occasionId ?? categoryId ?? city ?? search

    if (useNewModel) {
        let query = supabase
            .from('offerable_services')
            .select('id, category_id, name, description, image_url, display_order, price_min, price_max, price_unit, price_basic, price_classic_value, price_signature, price_prestige, price_royal, price_imperial, qty_label_basic, qty_label_classic_value, qty_label_signature, qty_label_prestige, qty_label_royal, qty_label_imperial, tag_new, tag_most_booked, city')
            .eq('is_active', true)
            .order('display_order', { ascending: true })

        if (categoryId) {
            query = query.eq('category_id', categoryId)
        }
        if (city) {
            query = query.eq('city', city)
        }
        if (search && search.trim()) {
            query = query.or(`name.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`)
        }

        const { data: services, error: svcError } = await query

        if (svcError) {
            return NextResponse.json({ error: svcError.message }, { status: 500 })
        }

        let list = services ?? []

        if (occasionId && list.length > 0) {
            const { data: links } = await supabase
                .from('service_occasions')
                .select('service_id')
                .eq('occasion_id', occasionId)
            const allowedIds = new Set((links ?? []).map((l: { service_id: string }) => l.service_id))
            list = list.filter((s: { id: string }) => allowedIds.has(s.id))
        }

        return NextResponse.json(list)
    }

    // Legacy: eventType + app_service_catalog
    try {
        const { data: catalog, error: catalogError } = await supabase
            .from('app_service_catalog')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true })

        if (!catalogError && catalog?.length) {
            const list =
                eventType && eventType !== 'all'
                    ? catalog.filter((row: { event_types?: string[] }) => row.event_types?.includes(eventType))
                    : catalog
            return NextResponse.json(list)
        }

        const { data: categories, error: catError } = await supabase
            .from('vendor_categories')
            .select('id, name')
            .order('name', { ascending: true })

        if (catError || !categories?.length) {
            return NextResponse.json([])
        }

        const mapped = categories.map((c: { id: string; name: string }, i: number) => ({
            id: String(c.id),
            name: c.name,
            icon: '🎯',
            event_types: ['wedding', 'janayu', 'social', 'birthday', 'corporate', 'funeral'],
            display_order: i,
        }))
        return NextResponse.json(mapped)
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
