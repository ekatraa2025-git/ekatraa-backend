import type { SupabaseClient } from '@supabase/supabase-js'

export function eInviteIdsFromLineOptions(options: unknown): string | null {
    if (!options || typeof options !== 'object' || Array.isArray(options)) return null
    const raw = (options as Record<string, unknown>).user_e_invite_id
    const id = raw != null ? String(raw).trim() : ''
    return id || null
}

export function eInviteIdsFromItems(items: { options?: unknown }[]): string[] {
    const ids = new Set<string>()
    for (const item of items) {
        const id = eInviteIdsFromLineOptions(item.options)
        if (id) ids.add(id)
    }
    return [...ids]
}

/** Mark e-invites paid after cart checkout (full payment). Idempotent for already-paid rows. */
export async function markUserEInvitesPaidAfterOrder(
    supabase: SupabaseClient,
    inviteIds: string[],
    userId: string,
    payment?: { razorpay_order_id?: string; razorpay_payment_id?: string }
): Promise<void> {
    if (!inviteIds.length || !userId) return
    const now = new Date().toISOString()
    await supabase
        .from('user_e_invites')
        .update({
            payment_status: 'paid',
            paid_at: now,
            updated_at: now,
            ...(payment?.razorpay_order_id ? { razorpay_order_id: payment.razorpay_order_id } : {}),
            ...(payment?.razorpay_payment_id ? { razorpay_payment_id: payment.razorpay_payment_id } : {}),
        })
        .in('id', inviteIds)
        .eq('user_id', userId)
        .eq('payment_status', 'unpaid')
}
