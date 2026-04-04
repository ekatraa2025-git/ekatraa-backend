import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/admin/service-occasions/bulk
 * Body: { service_ids: string[], occasion_ids: string[], replace?: boolean }
 * Links many catalog services to many occasions (adds rows; optional replace clears existing links for those services first).
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const serviceIds: string[] = Array.isArray(body.service_ids)
            ? body.service_ids.filter((x: unknown) => typeof x === 'string')
            : []
        const occasionIds: string[] = Array.isArray(body.occasion_ids)
            ? body.occasion_ids.filter((x: unknown) => typeof x === 'string')
            : []
        const replace = body.replace === true

        if (serviceIds.length === 0 || occasionIds.length === 0) {
            return NextResponse.json(
                { error: 'service_ids and occasion_ids must be non-empty arrays' },
                { status: 400 }
            )
        }

        if (replace) {
            await supabase.from('service_occasions').delete().in('service_id', serviceIds)
        }

        const rows = serviceIds.flatMap((service_id) =>
            occasionIds.map((occasion_id) => ({ service_id, occasion_id }))
        )

        const { error } = await supabase.from('service_occasions').upsert(rows, {
            onConflict: 'occasion_id,service_id',
            ignoreDuplicates: false,
        })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, linked: rows.length })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
