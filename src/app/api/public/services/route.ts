import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/services?eventType=wedding
 * Returns app service catalog filtered by event type (get-together type).
 * Falls back to vendor_categories if app_service_catalog does not exist.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const eventType = searchParams.get('eventType') || searchParams.get('event_type')

    try {
        const { data: catalog, error: catalogError } = await supabase
            .from('app_service_catalog')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true })

        if (!catalogError && catalog?.length) {
            const list = eventType && eventType !== 'all'
                ? catalog.filter((row: { event_types?: string[] }) =>
                    row.event_types?.includes(eventType)
                )
                : catalog
            return NextResponse.json(list)
        }

        // Fallback: vendor_categories (no event-type filter)
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
        const list = eventType && eventType !== 'all' ? mapped : mapped
        return NextResponse.json(list)
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
