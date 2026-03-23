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
