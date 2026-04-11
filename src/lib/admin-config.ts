/**
 * Single allowlisted admin account for dashboard + /api/admin (override via ADMIN_EMAIL).
 * Compared case-insensitively so login matches even if env or Supabase stores different casing.
 */
const RAW = (process.env.ADMIN_EMAIL || 'admin@ekatraa.com').trim()
export const ADMIN_EMAIL = RAW.toLowerCase()

export function isAllowlistedAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false
    return email.trim().toLowerCase() === ADMIN_EMAIL
}
