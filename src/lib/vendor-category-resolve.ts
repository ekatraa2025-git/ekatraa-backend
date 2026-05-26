import type { SupabaseClient } from '@supabase/supabase-js'

/** Postgres UUID v4 — legacy vendor_categories ids; catalog categories.id is usually a TEXT slug. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CatalogRow = { id: unknown; name?: unknown }

export function isCatalogUuid(value: unknown): boolean {
    return typeof value === 'string' && UUID_RE.test(value.trim())
}

function normKey(s: string): string {
    return s
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9\s+/\-]/g, ' ')
        .replace(/\s+/g, ' ')
}

/** Maps display names like "Venue + Menu" to seed-style slugs like "venue-menu". */
function slugFromCatalogName(name: string): string {
    return normKey(name).replace(/\s*\+\s*/g, '-').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function normalizeLegacySlug(raw: string): string {
    return normKey(raw).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function pickCatalogId(id: unknown): string | null {
    const s = String(id ?? '').trim()
    return s.length > 0 ? s : null
}

function catalogHit(row: CatalogRow | undefined): { id: string; name: string } | null {
    if (!row) return null
    const id = pickCatalogId(row.id)
    if (!id) return null
    return { id, name: String(row.name ?? '').trim() }
}

/** Loose match for legacy free-text vendor.category values (e.g. "Supplier- Puja Samagri"). */
function legacyNameMatchesCatalog(rowName: string, rawName: string): boolean {
    const rowNorm = normKey(rowName)
    const rawNorm = normKey(rawName)
    if (!rowNorm || !rawNorm) return false
    if (rowNorm === rawNorm) return true
    if (rawNorm.includes(rowNorm) || rowNorm.includes(rawNorm)) return true
    const rowSlug = slugFromCatalogName(rowName)
    const rawSlug = slugFromCatalogName(rawName)
    return rowSlug.length > 0 && (rowSlug === rawSlug || rawSlug.includes(rowSlug) || rowSlug.includes(rawSlug))
}

/**
 * Admin UI may send catalog slug `category_id` (e.g. venue-menu) or legacy UUID/name values.
 * Resolves to categories.id (TEXT slug) for vendors.category_id.
 */
export async function resolveVendorCategoryIdForDb(
    supabase: SupabaseClient,
    categoryId: unknown,
    categoryName: unknown
): Promise<{ id: string | null; name: string | null; reason: string | null }> {
    const idRaw = categoryId != null ? String(categoryId).trim() : ''
    const nameRaw = categoryName != null ? String(categoryName).trim() : ''

    const { data: rows, error } = await supabase.from('categories').select('id,name')
    if (error) {
        return { id: null, name: null, reason: error.message }
    }
    if (!rows?.length) {
        return { id: null, name: null, reason: 'Categories catalog is empty.' }
    }

    if (idRaw) {
        const direct = catalogHit(rows.find((r) => String(r.id).trim() === idRaw))
        if (direct) return { ...direct, reason: null }

        const slug = normalizeLegacySlug(idRaw)
        const bySlugName = catalogHit(
            rows.find((r) => slugFromCatalogName(String(r.name || '')) === slug)
        )
        if (bySlugName) return { ...bySlugName, reason: null }
    }

    if (nameRaw) {
        const nk = normKey(nameRaw)
        const byName = catalogHit(rows.find((r) => normKey(String(r.name || '')) === nk))
        if (byName) return { ...byName, reason: null }

        const byLegacyName = catalogHit(
            rows.find((r) => legacyNameMatchesCatalog(String(r.name || ''), nameRaw))
        )
        if (byLegacyName) return { ...byLegacyName, reason: null }
    }

    if (idRaw && isCatalogUuid(idRaw)) {
        return { id: null, name: null, reason: 'category_id UUID not found in catalog.' }
    }

    return {
        id: null,
        name: null,
        reason:
            'Could not resolve category to a catalog id. Choose a category from the admin list, or align catalog ids with the database.',
    }
}

/** Writes resolved catalog slug + display name onto a vendor payload. */
export function applyResolvedVendorCategory(
    body: Record<string, unknown>,
    resolved: { id: string; name: string }
): void {
    body.category_id = resolved.id
    if (resolved.name) {
        body.category = resolved.name
    }
}
