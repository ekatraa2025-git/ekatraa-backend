import type { SupabaseClient } from '@supabase/supabase-js'

/** Postgres UUID v4 (and compatible) — catalog row ids on hosted DB are UUIDs. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isCatalogUuid(value: unknown): boolean {
    return typeof value === 'string' && UUID_RE.test(value.trim())
}

function normKey(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Maps display names like "Venue + Menu" to seed-style slugs like "venue-menu". */
function slugFromCatalogName(name: string): string {
    return normKey(name).replace(/\s*\+\s*/g, '-').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function normalizeLegacySlug(raw: string): string {
    return normKey(raw).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function pickUuid(id: unknown): string | null {
    const s = String(id ?? '').trim()
    return isCatalogUuid(s) ? s : null
}

/**
 * Admin UI may send legacy slug `category_id` (e.g. venue-menu) while `vendors.category_id` is UUID.
 * Resolves to the catalog row UUID using slug-from-name, legacy id match, or display name.
 */
export async function resolveVendorCategoryIdForDb(
    supabase: SupabaseClient,
    categoryId: unknown,
    categoryName: unknown
): Promise<{ id: string | null; reason: string | null }> {
    const idRaw = categoryId != null ? String(categoryId).trim() : ''
    const nameRaw = categoryName != null ? String(categoryName).trim() : ''

    const { data: rows, error } = await supabase.from('categories').select('id,name')
    if (error) {
        return { id: null, reason: error.message }
    }
    if (!rows?.length) {
        return { id: null, reason: 'Categories catalog is empty.' }
    }

    if (idRaw && isCatalogUuid(idRaw)) {
        const hit = rows.find((r) => String(r.id) === idRaw)
        const u = hit ? pickUuid(hit.id) : null
        if (u) return { id: u, reason: null }
        return { id: null, reason: 'category_id UUID not found in catalog.' }
    }

    if (idRaw) {
        const slug = normalizeLegacySlug(idRaw)
        const bySlugName = rows.find((r) => slugFromCatalogName(String(r.name || '')) === slug)
        const u1 = bySlugName ? pickUuid(bySlugName.id) : null
        if (u1) return { id: u1, reason: null }

        const byLegacyRowId = rows.find((r) => String(r.id) === idRaw)
        const u2 = byLegacyRowId ? pickUuid(byLegacyRowId.id) : null
        if (u2) return { id: u2, reason: null }
    }

    if (nameRaw) {
        const nk = normKey(nameRaw)
        const byName = rows.find((r) => normKey(String(r.name || '')) === nk)
        const u = byName ? pickUuid(byName.id) : null
        if (u) return { id: u, reason: null }
    }

    return {
        id: null,
        reason:
            'Could not resolve category to a catalog UUID. Use a category from the admin list, or align catalog ids with the database.',
    }
}
