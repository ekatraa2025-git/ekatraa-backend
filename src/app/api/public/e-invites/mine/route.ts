import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'
import { MAX_EINVITE_ITERATIONS } from '@/lib/e-invite-constants'

export async function GET(req: Request) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const { searchParams } = new URL(req.url)
        const limit = Math.min(60, Math.max(1, Number(searchParams.get('limit') || 30)))

        const { data, error } = await supabase
            .from('user_e_invites')
            .select('id, media_kind, storage_path, price_inr, payment_status, created_at, paid_at, form_payload')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit)
        const { data: counterRow } = await supabase
            .from('user_e_invite_generation_counters')
            .select('total_generations')
            .eq('user_id', userId)
            .maybeSingle()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const rows = Array.isArray(data) ? data : []
        const invites = await Promise.all(
            rows.map(async (r) => ({
                id: r.id,
                media_kind: r.media_kind,
                price_inr: r.price_inr,
                payment_status: r.payment_status,
                created_at: r.created_at,
                paid_at: r.paid_at,
                form_payload: r.form_payload,
                preview_url: await signedUrlForStorageRef(r.storage_path),
            }))
        )

        return NextResponse.json({
            invites,
            max_iterations: MAX_EINVITE_ITERATIONS,
            used_iterations: Number(counterRow?.total_generations || rows.length),
            remaining_iterations: Math.max(
                0,
                MAX_EINVITE_ITERATIONS - Number(counterRow?.total_generations || rows.length)
            ),
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
