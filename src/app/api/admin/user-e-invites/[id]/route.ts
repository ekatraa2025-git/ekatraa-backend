import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'

/** PATCH /api/admin/user-e-invites/[id] — admin_note, status, form_payload merge */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { id } = await ctx.params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (body.admin_note !== undefined) {
        updates.admin_note = String(body.admin_note || '').slice(0, 2000)
    }
    if (body.status !== undefined) {
        const s = String(body.status || '').trim()
        if (!['awaiting_payment', 'paid', 'cancelled'].includes(s)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }
        updates.status = s
    }
    if (body.form_payload !== undefined && typeof body.form_payload === 'object' && body.form_payload) {
        const { data: existing } = await supabase.from('user_e_invites').select('form_payload').eq('id', id).single()
        const prev = (existing?.form_payload && typeof existing.form_payload === 'object' ? existing.form_payload : {}) as Record<
            string,
            unknown
        >
        updates.form_payload = { ...prev, ...(body.form_payload as Record<string, unknown>) }
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase.from('user_e_invites').update(updates).eq('id', id).select().single()
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(data)
}
