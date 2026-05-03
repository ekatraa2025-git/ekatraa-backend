import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    try {
        const { id } = await params
        const inviteId = String(id || '').trim()
        if (!inviteId) {
            return NextResponse.json({ error: 'id required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('user_e_invites')
            .select('id, storage_path')
            .eq('id', inviteId)
            .single()

        if (error || !data) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const url = await signedUrlForStorageRef(data.storage_path)
        if (!url) {
            return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
        }

        return NextResponse.json({ url })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
