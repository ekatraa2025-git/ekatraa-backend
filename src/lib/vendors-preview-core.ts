import type { SupabaseClient } from '@supabase/supabase-js'

export type VendorsPreviewInput = {
    city?: string | null
    occasionId?: string | null
    limit?: number
}

export type VendorPreviewCard = {
    id: string
    display_label: string
    name_hint: string
    city: unknown
    state: unknown
    gallery_urls: string[]
    services: string[]
    contact_locked: boolean
    ekatraa_note: string
}

/**
 * Redacted vendor cards (same shape as GET /api/public/vendors/preview).
 */
export async function getVendorsPreviewCore(
    supabase: SupabaseClient,
    input: VendorsPreviewInput
): Promise<{ ok: true; data: VendorPreviewCard[] } | { ok: false; message: string }> {
    const city = input.city?.trim() || ''
    const occasionId = input.occasionId?.trim() || ''
    const limit = Math.min(Math.max(1, input.limit ?? 12), 30)

    let query = supabase
        .from('vendors')
        .select('id, business_name, city, state, gallery_urls, category_id, status')
        .eq('status', 'active')
        .order('business_name', { ascending: true })
        .limit(limit * 2)

    if (city) {
        query = query.ilike('city', `%${city}%`)
    }

    const { data: vendors, error } = await query

    if (error) {
        return { ok: false, message: error.message }
    }

    let list = vendors ?? []

    if (occasionId) {
        const { data: occCats } = await supabase
            .from('occasion_categories')
            .select('category_id')
            .eq('occasion_id', occasionId)
        const catIds = new Set((occCats ?? []).map((r: { category_id: string }) => r.category_id))
        if (catIds.size > 0) {
            list = list.filter((v: { category_id?: string | null }) =>
                v.category_id ? catIds.has(v.category_id) : true
            )
        }
    }

    const sliced = list.slice(0, limit)
    const ids = sliced.map((v: { id: string }) => v.id)

    const { data: svcRows } = await supabase
        .from('services')
        .select('vendor_id, name')
        .in('vendor_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])

    const servicesByVendor = new Map<string, string[]>()
    for (const row of svcRows ?? []) {
        const r = row as { vendor_id: string; name: string | null }
        if (!r.vendor_id) continue
        const arr = servicesByVendor.get(r.vendor_id) ?? []
        if (r.name) arr.push(r.name)
        servicesByVendor.set(r.vendor_id, arr)
    }

    const data: VendorPreviewCard[] = sliced.map((v: Record<string, unknown>, i: number) => {
        const id = v.id as string
        const name = String(v.business_name || 'Vendor')
        const short = name.length > 2 ? `${name.slice(0, 2)}…` : `${name[0] ?? 'V'}…`
        const gallery = Array.isArray(v.gallery_urls) ? (v.gallery_urls as string[]).filter(Boolean).slice(0, 6) : []
        return {
            id,
            display_label: `Top vendor ${i + 1}`,
            name_hint: short,
            city: v.city ?? null,
            state: v.state ?? null,
            gallery_urls: gallery,
            services: (servicesByVendor.get(id) ?? []).slice(0, 8),
            contact_locked: true,
            ekatraa_note: 'Ekatraa-ranked partner. Call/WhatsApp unlocks after advance payment.',
        }
    })

    return { ok: true, data }
}
