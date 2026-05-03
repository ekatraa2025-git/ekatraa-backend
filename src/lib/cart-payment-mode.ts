import { computeAdvanceInrFromBase } from '@/lib/booking-protection'

export type CartLineForPaymentMode = {
    options?: unknown
    offerable_services?: { is_special_catalog?: boolean | null } | { is_special_catalog?: boolean | null }[] | null
}

/**
 * Lines that are AI e-invites (cart options) or special-catalog offerable_services
 * must be settled in full at online checkout (no 20% advance for the whole cart).
 */
export function lineRequiresFullPayment(row: CartLineForPaymentMode): boolean {
    const opt =
        row.options && typeof row.options === 'object' && !Array.isArray(row.options)
            ? (row.options as Record<string, unknown>)
            : {}
    if (opt.line_kind === 'e_invite' || opt.user_e_invite_id != null) return true

    const raw = row.offerable_services
    const os = Array.isArray(raw) ? raw[0] : raw
    if (os && typeof os === 'object' && os.is_special_catalog === true) return true
    return false
}

export function cartRequiresFullPayment(items: CartLineForPaymentMode[] | null | undefined): boolean {
    if (!Array.isArray(items) || items.length === 0) return false
    return items.some(lineRequiresFullPayment)
}

export function computeOnlineChargeInr(
    cartSubtotalInr: number,
    protectionInr: number,
    fullPayment: boolean,
    advancePercent = 20
): number {
    if (fullPayment) {
        return Math.max(1, Math.round(cartSubtotalInr + protectionInr))
    }
    return Math.max(1, computeAdvanceInrFromBase(cartSubtotalInr, protectionInr, advancePercent))
}
