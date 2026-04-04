import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Admin CRUD for offerable_services (new flow services).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')
    const specialCatalog = searchParams.get('special_catalog')
    const occasionId = searchParams.get('occasion_id')

    let query = supabase
        .from('offerable_services')
        .select('*')
        .order('display_order', { ascending: true })

    if (categoryId) query = query.eq('category_id', categoryId)
    if (specialCatalog === '1' || specialCatalog === 'true') {
        query = query.eq('is_special_catalog', true)
    }

    if (occasionId) {
        const { data: links, error: linkErr } = await supabase
            .from('service_occasions')
            .select('service_id')
            .eq('occasion_id', occasionId)
        if (linkErr) {
            return NextResponse.json({ error: linkErr.message }, { status: 500 })
        }
        const ids = [...new Set((links ?? []).map((l: { service_id: string }) => l.service_id))]
        if (ids.length === 0) {
            return NextResponse.json([])
        }
        query = query.in('id', ids)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const occasionIds: string[] | undefined = Array.isArray(body.occasion_ids)
            ? body.occasion_ids.filter((x: unknown) => typeof x === 'string')
            : undefined
        const singleOccasion: string | undefined =
            typeof body.occasion_id === 'string' ? body.occasion_id : undefined
        delete body.occasion_ids
        delete body.occasion_id

        const { data, error } = await supabase
            .from('offerable_services')
            .insert([{ ...body, is_active: body.is_active !== false }])
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        const serviceId = data?.id as string | undefined
        const toLink = occasionIds?.length
            ? occasionIds
            : singleOccasion
              ? [singleOccasion]
              : []
        if (serviceId && toLink.length > 0) {
            const rows = toLink.map((occasion_id) => ({ occasion_id, service_id: serviceId }))
            const { error: soErr } = await supabase.from('service_occasions').upsert(rows, {
                onConflict: 'occasion_id,service_id',
                ignoreDuplicates: false,
            })
            if (soErr) {
                console.error('service_occasions insert:', soErr.message)
                return NextResponse.json(
                    { error: 'Service created but occasion link failed: ' + soErr.message, service: data },
                    { status: 500 }
                )
            }
        }

        return NextResponse.json(data, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
