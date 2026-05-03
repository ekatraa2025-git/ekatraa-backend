import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin-session'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!id?.trim()) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const { data: row, error } = await supabase
        .from('user_e_invites')
        .select('storage_path')
        .eq('id', id)
        .maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!row?.storage_path) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const url = await signedUrlForStorageRef(row.storage_path)
    if (!url) {
        return NextResponse.json({ error: 'Could not sign URL' }, { status: 400 })
    }

    return NextResponse.json({ url })
}
