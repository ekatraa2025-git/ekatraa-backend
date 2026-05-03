import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin-session'
import { supabase } from '@/lib/supabase/server'

const BUCKET = 'ekatraa2025'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!id?.trim()) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (body.admin_note !== undefined) {
        updates.admin_note = body.admin_note === null ? null : String(body.admin_note)
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
        .from('user_e_invites')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!id?.trim()) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const { data: row, error: fetchErr } = await supabase
        .from('user_e_invites')
        .select('id, storage_path')
        .eq('id', id)
        .maybeSingle()

    if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 400 })
    }
    if (!row) {
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
}
