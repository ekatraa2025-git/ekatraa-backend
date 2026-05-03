import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

/**
 * GET /api/public/e-invites/mine/[id]/download
 * Fresh signed URL for the owner's paid invite (URLs from list/generate expire).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(_req)
        if (authError) return authError

        const { id } = await params
        if (!id?.trim()) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
        }

        const { data: row, error } = await supabase
            .from('user_e_invites')
            .select('user_id, storage_path, payment_status')
            .eq('id', id)
            .maybeSingle()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        if (!row || row.user_id !== userId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        if (row.payment_status !== 'paid') {
            return NextResponse.json({ error: 'Payment required' }, { status: 402 })
        }

        const url = await signedUrlForStorageRef(row.storage_path)
        if (!url) {
            return NextResponse.json({ error: 'Could not create download URL' }, { status: 500 })
        }

        return NextResponse.json({ url })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
