import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

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

        return NextResponse.json({ invites })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
