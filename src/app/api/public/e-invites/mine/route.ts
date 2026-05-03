import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/** GET /api/public/e-invites/mine — list current user's generated invites */
export async function GET(req: Request) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { searchParams } = new URL(req.url)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))

    const { data, error } = await supabase
        .from('user_e_invites')
        .select('id, media_kind, status, price_inr, storage_path, form_payload, created_at, paid_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = Array.isArray(data) ? data : []
    const enriched = await Promise.all(
        rows.map(async (r) => ({
            ...r,
            preview_url: (await signedUrlForStorageRef(r.storage_path)) || null,
        }))
    )

    return NextResponse.json({ invites: enriched })
}
