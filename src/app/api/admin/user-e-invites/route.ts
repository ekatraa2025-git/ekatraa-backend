import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

export async function GET(req: Request) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 120)))

    const { data, error } = await supabase
        .from('user_e_invites')
        .select(
            'id, user_id, media_kind, storage_path, price_inr, payment_status, created_at, paid_at, form_payload, admin_note'
        )
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = Array.isArray(data) ? data : []
    const invites = await Promise.all(
        rows.map(async (r) => ({
            id: r.id,
            user_id: r.user_id,
            media_kind: r.media_kind,
            status: r.payment_status,
            price_inr: r.price_inr,
            storage_path: r.storage_path,
            form_payload: r.form_payload,
            preview_url: await signedUrlForStorageRef(r.storage_path),
            created_at: r.created_at,
            paid_at: r.paid_at,
            admin_note: r.admin_note,
        }))
    )

    return NextResponse.json({ invites })
}
