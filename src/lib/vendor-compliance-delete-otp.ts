import { supabase } from '@/lib/supabase/server'

const TTL_MS = 10 * 60 * 1000

export function generateVendorDeletionOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000))
}

export async function upsertVendorDeletionOtp(phoneDigits10: string, otp: string): Promise<void> {
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString()
    await supabase.from('vendor_account_deletion_otp').delete().eq('phone_digits', phoneDigits10)
    const { error } = await supabase.from('vendor_account_deletion_otp').insert({
        phone_digits: phoneDigits10,
        otp_code: otp,
        expires_at: expiresAt,
    })
    if (error) throw new Error(error.message)
}

/** Latest OTP row for phone (avoids maybeSingle() failure when duplicates exist). */
async function fetchLatestDeletionOtpRow(phoneDigits10: string) {
    const { data: rows, error } = await supabase
        .from('vendor_account_deletion_otp')
        .select('id, otp_code, expires_at')
        .eq('phone_digits', phoneDigits10)
        .order('created_at', { ascending: false })
        .limit(1)

    if (error || !rows?.length) return null
    return rows[0]
}

/**
 * Validates OTP without consuming it — used before destructive purge so failures can retry with the same code.
 */
export async function validateVendorDeletionOtp(phoneDigits10: string, otp: string): Promise<boolean> {
    const trimmed = otp.trim()
    if (!/^\d{6}$/.test(trimmed)) return false

    const data = await fetchLatestDeletionOtpRow(phoneDigits10)
    if (!data) return false

    if (new Date(data.expires_at) < new Date()) {
        await supabase.from('vendor_account_deletion_otp').delete().eq('id', data.id)
        return false
    }

    return String(data.otp_code) === trimmed
}

/** Removes OTP challenge(s) for phone after successful deletion (or cleanup). */
export async function clearVendorDeletionOtpForPhone(phoneDigits10: string): Promise<void> {
    await supabase.from('vendor_account_deletion_otp').delete().eq('phone_digits', phoneDigits10)
}

/** Returns true only when OTP matches and challenge is cleared (single-use). Prefer validate + purge + clear for transactional semantics. */
export async function verifyAndClearVendorDeletionOtp(phoneDigits10: string, otp: string): Promise<boolean> {
    const ok = await validateVendorDeletionOtp(phoneDigits10, otp)
    if (!ok) return false
    await clearVendorDeletionOtpForPhone(phoneDigits10)
    return true
}
