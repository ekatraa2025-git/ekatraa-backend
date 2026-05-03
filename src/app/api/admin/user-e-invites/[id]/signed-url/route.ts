import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

/** GET /api/admin/user-e-invites/[id]/signed-url — admin download */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data: row, error } = await supabase.from('user_e_invites').select('storage_path').eq('id', id).single()
    if (error || !row?.storage_path) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const url = await signedUrlForStorageRef(row.storage_path)
    if (!url) return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
    return NextResponse.json({ url, path: row.storage_path })
}
