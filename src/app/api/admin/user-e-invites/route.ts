import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

/** GET /api/admin/user-e-invites */
export async function GET(req: Request) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 80))
    const status = searchParams.get('status')?.trim()

    let q = supabase
        .from('user_e_invites')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (status && ['awaiting_payment', 'paid', 'cancelled'].includes(status)) {
        q = q.eq('status', status)
    }

    const { data, error } = await q
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = Array.isArray(data) ? data : []
    const enriched = await Promise.all(
        rows.map(async (r: Record<string, unknown>) => ({
            ...r,
            preview_url: (await signedUrlForStorageRef(String(r.storage_path || ''))) || null,
        }))
    )

    return NextResponse.json({ invites: enriched })
}
