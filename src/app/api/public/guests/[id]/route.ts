import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * PATCH /api/public/guests/[id]
 * Update a guest. Body: { name?, phone?, relation?, group_name?, notes?, rsvp?, invited? }
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Guest id required' }, { status: 400 })
    }

    const { data: guest, error: fetchErr } = await supabase
        .from('guest_lists')
        .select('user_id')
        .eq('id', id)
        .single()

    if (fetchErr || !guest) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
    }

    if (guest.user_id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const allowed = ['name', 'phone', 'relation', 'group_name', 'notes', 'rsvp', 'invited']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('guest_lists')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(data)
}

/**
 * DELETE /api/public/guests/[id]
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Guest id required' }, { status: 400 })
    }

    const { data: guest, error: fetchErr } = await supabase
        .from('guest_lists')
        .select('user_id')
        .eq('id', id)
        .single()

    if (fetchErr || !guest) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
    }

    if (guest.user_id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error } = await supabase.from('guest_lists').delete().eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ deleted: true })
}
