import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    try {
        const { id } = await params
        const inviteId = String(id || '').trim()
        if (!inviteId) {
            return NextResponse.json({ error: 'id required' }, { status: 400 })
        }

        const body = await req.json().catch(() => ({}))
        const note = body.admin_note != null ? String(body.admin_note) : undefined
        if (note === undefined) {
            return NextResponse.json({ error: 'admin_note is required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('user_e_invites')
            .update({ admin_note: note })
            .eq('id', inviteId)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json(data)
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
