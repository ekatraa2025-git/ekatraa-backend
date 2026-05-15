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

function ignorableNoTableError(err: { message?: string; code?: string } | null): boolean {
    const m = String(err?.message || '')
    return (
        err?.code === '42P01' ||
        /does not exist|Could not find the table|schema cache|relation .* does not exist/i.test(m)
    )
}

/** Best-effort delete rows scoped by vendor_id (covers FKs that may not CASCADE). */
async function deleteVendorScoped(table: string, vendorId: string): Promise<{ error?: string }> {
    const { error } = await supabase.from(table).delete().eq('vendor_id', vendorId)
    if (!error) return {}
    if (ignorableNoTableError(error)) return {}
    return { error: `${table}: ${error.message}` }
}

/**
 * Permanently remove a vendor business record and linked catalog rows; clears order FK first.
 * Attempts Supabase auth user deletion when vendor id matches the primary login UUID.
 */
export async function purgeVendorBusinessAccount(vendorId: string): Promise<{ error?: string }> {
    const { data: servicesRows, error: svcQErr } = await supabase
        .from('services')
        .select('id')
        .eq('vendor_id', vendorId)
    if (svcQErr) return { error: `services(select): ${svcQErr.message}` }
    const serviceIds = (servicesRows ?? []).map((r: { id: string }) => String(r.id)).filter(Boolean)

    if (serviceIds.length) {
        const { error: ciErr } = await supabase.from('cart_items').delete().in('service_id', serviceIds)
        if (ciErr && !ignorableNoTableError(ciErr)) return { error: `cart_items: ${ciErr.message}` }
    }

    const scopedTables = [
        'vendor_notifications',
        'vendor_quote_otp_challenges',
        'vendor_order_team_assignments',
        'quotations',
        'services',
        'offerable_service_vendors',
        'order_vendor_invoices',
        'order_item_allocations',
        'vendor_push_tokens',
        'vendor_team_members',
    ] as const

    for (const table of scopedTables) {
        const r = await deleteVendorScoped(table, vendorId)
        if (r.error) return r
    }

    const { error: u1 } = await supabase.from('orders').update({ vendor_id: null }).eq('vendor_id', vendorId)
    if (u1) return { error: `orders: ${u1.message}` }

    const { error: v1 } = await supabase.from('vendors').delete().eq('id', vendorId)
    if (v1) return { error: `vendors: ${v1.message}` }

    const { error: authErr } = await supabase.auth.admin.deleteUser(vendorId)
    if (authErr?.message && !/not found|User not found/i.test(authErr.message)) {
        return { error: `auth: ${authErr.message}` }
    }
    return {}
}
