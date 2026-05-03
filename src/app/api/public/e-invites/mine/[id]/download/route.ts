import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const { id } = await params
        const inviteId = String(id || '').trim()
        if (!inviteId) {
            return NextResponse.json({ error: 'id required' }, { status: 400 })
        }

        const { data: inv, error } = await supabase
            .from('user_e_invites')
            .select('id, user_id, storage_path, payment_status')
            .eq('id', inviteId)
            .single()

        if (error || !inv) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        if (inv.user_id !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
        if (inv.payment_status !== 'paid') {
            return NextResponse.json({ error: 'Payment required', code: 'PAYMENT_REQUIRED' }, { status: 402 })
        }

        const url = await signedUrlForStorageRef(inv.storage_path)
        if (!url) {
            return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
        }

        return NextResponse.json({ url })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
