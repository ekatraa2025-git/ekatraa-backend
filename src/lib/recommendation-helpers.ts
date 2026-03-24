/**
 * Tier metadata aligned with app offerable_services columns (CategoryServices.js).
 */
export const OFFERABLE_TIER_DEFS: { key: string; label: string }[] = [
    { key: 'price_basic', label: 'Basic' },
    { key: 'price_classic_value', label: 'Classic Value' },
    { key: 'price_signature', label: 'Signature' },
    { key: 'price_prestige', label: 'Prestige' },
    { key: 'price_royal', label: 'Royal' },
    { key: 'price_imperial', label: 'Imperial' },
]

/** Postgres DECIMAL often arrives as string in JSON; normalize for math and API output. */
function coercePrice(raw: unknown): number | null {
    if (raw == null) return null
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
    }
    return null
}

export type OfferableServiceRow = {
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

export function getMinTierPrice(s: OfferableServiceRow): number {
    const vals = [
        coercePrice(s.price_min),
        coercePrice(s.price_basic),
        coercePrice(s.price_classic_value),
        coercePrice(s.price_signature),
        coercePrice(s.price_prestige),
        coercePrice(s.price_royal),
        coercePrice(s.price_imperial),
    ].filter((v): v is number => v != null)
    return vals.length ? Math.min(...vals) : Infinity
}

export function buildTiersForService(
    s: OfferableServiceRow,
    allocatedBudget: number
): Array<{ key: string; label: string; price: number | null; fits_allocation: boolean }> {
    return OFFERABLE_TIER_DEFS.map((def) => {
        const raw = s[def.key as keyof OfferableServiceRow]
        const price = coercePrice(raw)
        return {
            key: def.key,
            label: def.label,
            price,
            fits_allocation: price != null && price <= allocatedBudget,
        }
    })
}

export function selectionNoteForService(
    s: OfferableServiceRow,
    allocatedBudget: number
): string {
    const minP = getMinTierPrice(s)
    if (minP === Infinity) return 'No tier prices configured for this service.'
    if (minP <= allocatedBudget) {
        return 'At least one tier price is within this category allocation.'
    }
    return 'All configured tier prices are above this category allocation.'
}

/**
 * Merge DB allocation percentages with optional client overrides.
 * If overrides are provided (non-empty), raw values are normalized to sum to 100%.
 * If not, DB percentages are used as-is (same as pre–schema_version 2 behavior).
 */
export function effectivePercentages(
    rows: { category_id: string; percentage: number }[],
    overrides: Record<string, number> | null
): Map<string, number> {
    const ids = rows.map((r) => r.category_id)
    const out = new Map<string, number>()
    const hasOverrides = overrides != null && Object.keys(overrides).length > 0

    const raw: number[] = rows.map((r) => {
        const o = overrides?.[r.category_id]
        if (o != null && !Number.isNaN(Number(o))) return Number(o)
        return Number(r.percentage)
    })

    if (!hasOverrides) {
        ids.forEach((id, i) => out.set(id, raw[i]!))
        return out
    }

    const sum = raw.reduce((a, b) => a + b, 0)
    if (sum <= 0) {
        for (const id of ids) out.set(id, 0)
        return out
    }
    ids.forEach((id, i) => {
        out.set(id, (raw[i]! / sum) * 100)
    })
    return out
}

export function normalizeWeightsForCategories(
    categoryIds: string[],
    overrides: Record<string, number> | null
): Map<string, number> {
    const out = new Map<string, number>()
    if (categoryIds.length === 0) return out
    const raw = categoryIds.map((id) => {
        const o = overrides?.[id]
        return o != null && !Number.isNaN(Number(o)) ? Number(o) : 0
    })
    const sum = raw.reduce((a, b) => a + b, 0)
    if (sum <= 0) {
        const eq = 100 / categoryIds.length
        for (const id of categoryIds) out.set(id, eq)
        return out
    }
    categoryIds.forEach((id, i) => {
        out.set(id, (raw[i]! / sum) * 100)
    })
    return out
}
