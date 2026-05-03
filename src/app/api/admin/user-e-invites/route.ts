import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin-session'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

const BUCKET = 'ekatraa2025'

export async function GET(req: Request) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') || 120)))

    const { data, error } = await supabase
        .from('user_e_invites')
        .select(
            'id, user_id, media_kind, payment_status, price_inr, storage_path, form_payload, created_at, paid_at, admin_note'
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
            payment_status: r.payment_status,
            price_inr: r.price_inr,
            storage_path: r.storage_path,
            form_payload: r.form_payload,
            admin_note: r.admin_note,
            created_at: r.created_at,
            paid_at: r.paid_at,
            preview_url: await signedUrlForStorageRef(r.storage_path),
        }))
    )

    return NextResponse.json({ invites })
}

export async function DELETE(req: Request) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body.ids)
        ? body.ids.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
        : []

    if (ids.length === 0) {
        return NextResponse.json({ error: 'ids array required' }, { status: 400 })
    }

    const { data: rows, error: fetchErr } = await supabase
        .from('user_e_invites')
        .select('id, storage_path')
        .in('id', ids)

    if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 400 })
    }

    const paths = (rows || [])
        .map((r) => r.storage_path)
        .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)

    if (paths.length > 0) {
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths)
        if (rmErr) {
            return NextResponse.json({ error: rmErr.message || 'Storage delete failed' }, { status: 400 })
        }
    }

    const { error: delErr } = await supabase.from('user_e_invites').delete().in('id', ids)
    if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, deleted: ids.length })
}
