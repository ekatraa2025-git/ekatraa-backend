import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/** GET /api/public/e-invites/mine/[id]/download — signed URL after payment */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { id } = await ctx.params
    if (!id) {
        return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { data: row, error } = await supabase
        .from('user_e_invites')
        .select('id, user_id, status, storage_path')
        .eq('id', id)
        .single()

    if (error || !row) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (row.user_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (row.status !== 'paid') {
        return NextResponse.json({ error: 'Complete payment to download' }, { status: 402 })
    }

    const url = await signedUrlForStorageRef(row.storage_path)
    if (!url) {
        return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
    }

    return NextResponse.json({ url, user_e_invite_id: row.id })
}
