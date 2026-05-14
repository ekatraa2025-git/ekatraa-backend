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

/** Returns true only when OTP matches and challenge is cleared (single-use). */
export async function verifyAndClearVendorDeletionOtp(phoneDigits10: string, otp: string): Promise<boolean> {
    const trimmed = otp.trim()
    if (!/^\d{6}$/.test(trimmed)) return false

    const { data, error } = await supabase
        .from('vendor_account_deletion_otp')
        .select('id, otp_code, expires_at')
        .eq('phone_digits', phoneDigits10)
        .maybeSingle()

    if (error || !data) return false

    if (new Date(data.expires_at) < new Date()) {
        await supabase.from('vendor_account_deletion_otp').delete().eq('id', data.id)
        return false
    }

    if (String(data.otp_code) !== trimmed) return false

    await supabase.from('vendor_account_deletion_otp').delete().eq('id', data.id)
    return true
}
