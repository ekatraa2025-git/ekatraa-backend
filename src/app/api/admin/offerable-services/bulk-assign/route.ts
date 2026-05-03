import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

/**
 * POST /api/admin/offerable-services/bulk-assign
 * Body:
 * {
 *   service_ids: string[],
 *   occasion_ids: string[],
 *   category_id: string,
 *   replace_occasion_links?: boolean
 * }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const serviceIds: string[] = Array.isArray(body.service_ids)
            ? body.service_ids.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
            : []
        const occasionIds: string[] = Array.isArray(body.occasion_ids)
            ? body.occasion_ids.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
            : []
        const categoryId = typeof body.category_id === 'string' ? body.category_id.trim() : ''
        const replaceOccasionLinks = body.replace_occasion_links !== false

        if (serviceIds.length === 0) {
            return NextResponse.json({ error: 'Select at least one service' }, { status: 400 })
        }
        if (!categoryId) {
            return NextResponse.json({ error: 'category_id is required' }, { status: 400 })
        }
        if (occasionIds.length === 0) {
            return NextResponse.json({ error: 'Select at least one occasion' }, { status: 400 })
        }

        const { error: updErr } = await supabase
            .from('offerable_services')
            .update({ category_id: categoryId })
            .in('id', serviceIds)
        if (updErr) {
            return NextResponse.json({ error: updErr.message }, { status: 400 })
        }

        if (replaceOccasionLinks) {
            const { error: delErr } = await supabase.from('service_occasions').delete().in('service_id', serviceIds)
            if (delErr) {
                return NextResponse.json({ error: delErr.message }, { status: 400 })
            }
        }

        const rows = serviceIds.flatMap((service_id) => occasionIds.map((occasion_id) => ({ service_id, occasion_id })))
        const { error: linkErr } = await supabase.from('service_occasions').upsert(rows, {
            onConflict: 'occasion_id,service_id',
            ignoreDuplicates: false,
        })
        if (linkErr) {
            return NextResponse.json({ error: linkErr.message }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            updated_services: serviceIds.length,
            linked_occasion_rows: rows.length,
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
