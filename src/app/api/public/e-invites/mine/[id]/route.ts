import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase/server'

const BUCKET = 'ekatraa2025'

/**
 * DELETE /api/public/e-invites/mine/[id]
 * Owner deletes their invite + storage object. Does not change generation counters.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const { id } = await params
        if (!id?.trim()) {
            return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
        }

        const { data: row, error: fetchErr } = await supabase
            .from('user_e_invites')
            .select('id, user_id, storage_path')
            .eq('id', id)
            .maybeSingle()

        if (fetchErr) {
            return NextResponse.json({ error: fetchErr.message }, { status: 400 })
        }
        if (!row || row.user_id !== userId) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const path = row.storage_path
        if (typeof path === 'string' && path.trim()) {
            const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path])
            if (rmErr) {
                return NextResponse.json({ error: rmErr.message || 'Storage delete failed' }, { status: 400 })
            }
        }

        const { error: delErr } = await supabase.from('user_e_invites').delete().eq('id', id)
        if (delErr) {
            return NextResponse.json({ error: delErr.message }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
