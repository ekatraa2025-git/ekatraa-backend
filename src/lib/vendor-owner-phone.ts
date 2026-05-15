import { createClient } from '@supabase/supabase-js'
import { normalizePhoneDigits } from '@/lib/phone-normalize'

/**
 * Registered contact for vendor owner flows (OTP, notifications).
 * Prefers `vendors.phone`, then Supabase Auth `user.phone` from the same Bearer session.
 */
export async function resolveVendorOwnerPhoneDigits(
    req: Request,
    vendorPhoneFromDb: string | null | undefined
): Promise<string> {
    const fromRow = normalizePhoneDigits(vendorPhoneFromDb)
    if (fromRow.length === 10) return fromRow

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    if (!token) return ''

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return ''

    const anon = createClient(supabaseUrl, supabaseAnonKey)
    const {
        data: { user },
    } = await anon.auth.getUser(token)
    return normalizePhoneDigits(user?.phone ?? '')
}
