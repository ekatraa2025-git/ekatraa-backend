/**
 * Budget string to numeric mapping (INR) for recommendation algorithm.
 * Shared between backend API and optionally app for consistency.
 */

export const BUDGET_OPTIONS: Record<string, number> = {
    '6-10 Lakhs': 800_000,   // midpoint of 600k-1M
    '11-15 Lakhs': 1_300_000,
    '16-20 Lakhs': 1_800_000,
    '21-30 Lakhs': 2_550_000,
    '30 Lakhs+': 3_500_000,
    '50 Lakhs+': 6_000_000,
}

/**
 * Convert budget string (e.g. "6-10 Lakhs") or numeric (lakhs) to INR amount.
 * @param budget - Budget option string or number in lakhs
 * @returns Amount in INR, or 0 if unrecognized
 */
export function budgetToInr(budget: string | number): number {
    if (typeof budget === 'number') {
        return budget * 100_000
    }
    if (typeof budget !== 'string' || !budget.trim()) return 0
    const normalized = budget.trim()
    const fromMap = BUDGET_OPTIONS[normalized]
    if (fromMap != null) return fromMap
    // Try parse number (lakhs)
    const num = Number.parseFloat(normalized)
    if (!Number.isNaN(num)) return num * 100_000
    return 0
}

/** Slider range: ₹1 lakh to ₹2 crore (INR). */
export const MIN_BUDGET_INR = 100_000
export const MAX_BUDGET_INR = 20_000_000

export function clampBudgetInr(inr: number): number {
    if (!Number.isFinite(inr) || inr <= 0) return 0
    return Math.min(MAX_BUDGET_INR, Math.max(MIN_BUDGET_INR, Math.round(inr)))
}

/** Short display label for cart / UI (e.g. ₹15.5 Lakhs). */
export function formatBudgetInrLabel(inr: number): string {
    if (!Number.isFinite(inr) || inr <= 0) return ''
    const lakhs = inr / 100_000
    if (lakhs >= 100) {
        const cr = lakhs / 100
        const s = cr >= 10 ? cr.toFixed(1) : cr.toFixed(2)
        return `₹${s.replace(/\.?0+$/, '')} Cr`
    }
    const s = lakhs >= 10 ? lakhs.toFixed(1) : lakhs.toFixed(2)
    return `₹${s.replace(/\.?0+$/, '')} Lakhs`
}
