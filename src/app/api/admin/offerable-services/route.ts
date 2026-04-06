import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Admin CRUD for offerable_services (new flow services).
 */
function parseCsvIds(searchParams: URLSearchParams, key: string): string[] {
    const raw = searchParams.get(key)
    if (!raw) return []
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter((x) => x.length > 0)
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')
    const specialCatalog = searchParams.get('special_catalog')
    const occasionIdSingle = searchParams.get('occasion_id')
    const occasionIdsCsv = parseCsvIds(searchParams, 'occasion_ids')
    const occasionIds =
        occasionIdsCsv.length > 0
            ? occasionIdsCsv
            : occasionIdSingle
              ? [occasionIdSingle]
              : []
    const vendorIdsCsv = parseCsvIds(searchParams, 'vendor_ids')

    let query = supabase
        .from('offerable_services')
        .select('*')
        .order('display_order', { ascending: true })

    if (categoryId) query = query.eq('category_id', categoryId)
    if (specialCatalog === '1' || specialCatalog === 'true') {
        query = query.eq('is_special_catalog', true)
    }

    if (occasionIds.length > 0) {
        const { data: links, error: linkErr } = await supabase
            .from('service_occasions')
            .select('service_id')
            .in('occasion_id', occasionIds)
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
    let list = data ?? []

    if (vendorIdsCsv.length > 0 && list.length > 0) {
        const candidateIds = list.map((r: { id: string }) => r.id)
        const { data: vrows, error: vErr } = await supabase
            .from('offerable_service_vendors')
            .select('offerable_service_id, vendor_id')
            .in('offerable_service_id', candidateIds)
        if (vErr) {
            return NextResponse.json({ error: vErr.message }, { status: 500 })
        }
        const byService = new Map<string, Set<string>>()
        for (const r of vrows ?? []) {
            const row = r as { offerable_service_id: string; vendor_id: string }
            if (!byService.has(row.offerable_service_id))
                byService.set(row.offerable_service_id, new Set())
            byService.get(row.offerable_service_id)!.add(row.vendor_id)
        }
        const want = new Set(vendorIdsCsv)
        list = list.filter((row: { id: string }) => {
            const vset = byService.get(row.id)
            if (!vset || vset.size === 0) return true
            for (const v of want) if (vset.has(v)) return true
            return false
        })
    }

    return NextResponse.json(list)
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const occasionIds: string[] | undefined = Array.isArray(body.occasion_ids)
            ? body.occasion_ids.filter((x: unknown) => typeof x === 'string')
            : undefined
        const singleOccasion: string | undefined =
            typeof body.occasion_id === 'string' ? body.occasion_id : undefined
        const vendorIds: string[] | undefined = Array.isArray(body.vendor_ids)
            ? (body.vendor_ids as unknown[]).filter((x): x is string => typeof x === 'string')
            : undefined
        delete body.occasion_ids
        delete body.occasion_id
        delete body.vendor_ids

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

        if (serviceId && vendorIds && vendorIds.length > 0) {
            const vrows = vendorIds.map((vendor_id) => ({
                offerable_service_id: serviceId,
                vendor_id,
            }))
            const { error: vErr } = await supabase.from('offerable_service_vendors').upsert(vrows, {
                onConflict: 'offerable_service_id,vendor_id',
                ignoreDuplicates: false,
            })
            if (vErr) {
                return NextResponse.json(
                    { error: 'Service created but vendor link failed: ' + vErr.message, service: data },
                    { status: 500 }
                )
            }
        }

        return NextResponse.json(data, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
