import { supabase } from '@/lib/supabase/server'
import { normalizePhoneDigits } from '@/lib/phone-normalize'

/**
 * Find vendor primary key IDs whose registered `vendors.phone` matches the given digits.
 */
export async function findVendorIdsByNormalizedPhone(digits10: string): Promise<string[]> {
    if (digits10.length !== 10) return []
    const { data, error } = await supabase.from('vendors').select('id, phone')
    if (error) throw new Error(error.message)
    const ids: string[] = []
    for (const row of data ?? []) {
        if (!row?.id) continue
        if (normalizePhoneDigits(row.phone as string) === digits10) {
            ids.push(String(row.id))
        }
    }
    return [...new Set(ids)]
}

/**
 * Permanently remove a vendor business record and linked catalog rows; clears order FK first.
 * Attempts Supabase auth user deletion when vendor id matches the primary login UUID.
 */
export async function purgeVendorBusinessAccount(vendorId: string): Promise<{ error?: string }> {
    const { error: u1 } = await supabase.from('orders').update({ vendor_id: null }).eq('vendor_id', vendorId)
    if (u1) return { error: `orders: ${u1.message}` }

    const { error: q1 } = await supabase.from('quotations').delete().eq('vendor_id', vendorId)
    if (q1) return { error: `quotations: ${q1.message}` }

    const { error: s1 } = await supabase.from('services').delete().eq('vendor_id', vendorId)
    if (s1) return { error: `services: ${s1.message}` }

    const { error: v1 } = await supabase.from('vendors').delete().eq('id', vendorId)
    if (v1) return { error: `vendors: ${v1.message}` }

    const { error: authErr } = await supabase.auth.admin.deleteUser(vendorId)
    if (authErr?.message && !/not found|User not found/i.test(authErr.message)) {
        return { error: `auth: ${authErr.message}` }
    }
    return {}
}
