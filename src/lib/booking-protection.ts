import { supabase } from '@/lib/supabase/server'

export type BookingProtectionMode = 'none' | 'fixed' | 'percent'

export type PlatformProtectionRow = {
    booking_protection_mode: BookingProtectionMode
    booking_protection_fixed_inr: number
    booking_protection_percent: number
}

const DEFAULTS: PlatformProtectionRow = {
    booking_protection_mode: 'none',
    booking_protection_fixed_inr: 0,
    booking_protection_percent: 0,
}

export async function fetchPlatformProtectionSettings(): Promise<PlatformProtectionRow> {
    const { data, error } = await supabase
        .from('platform_settings')
        .select('booking_protection_mode, booking_protection_fixed_inr, booking_protection_percent')
        .eq('id', 'default')
        .maybeSingle()

    if (error || !data) return DEFAULTS

    const mode = data.booking_protection_mode as BookingProtectionMode
    const safeMode: BookingProtectionMode =
        mode === 'fixed' || mode === 'percent' || mode === 'none' ? mode : 'none'

    return {
        booking_protection_mode: safeMode,
        booking_protection_fixed_inr: Number(data.booking_protection_fixed_inr ?? 0),
        booking_protection_percent: Number(data.booking_protection_percent ?? 0),
    }
}

/**
 * INR amount added for protection when the user opts in (admin mode + toggles).
 */
export function computeProtectionAmountInr(
    cartSubtotalInr: number,
    settings: PlatformProtectionRow,
    userWantsProtection: boolean
): number {
    if (!userWantsProtection) return 0
    const mode = settings.booking_protection_mode
    if (mode === 'none') return 0
    if (mode === 'fixed') {
        return Math.max(0, Math.round(Number(settings.booking_protection_fixed_inr || 0)))
    }
    if (mode === 'percent') {
        const p = Number(settings.booking_protection_percent || 0)
        return Math.round((cartSubtotalInr * p) / 100)
    }
    return 0
}

export function computeAdvanceInrFromBase(cartSubtotalInr: number, protectionInr: number, advancePercent = 20): number {
    const base = cartSubtotalInr + protectionInr
    return Math.round((base * advancePercent) / 100)
}
