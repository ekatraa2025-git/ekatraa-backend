import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * DELETE /api/public/gifts/[id]
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Gift id required' }, { status: 400 })
    }

    const { data: gift, error: fetchErr } = await supabase
        .from('guest_gifts')
        .select('user_id')
        .eq('id', id)
        .single()

    if (fetchErr || !gift) {
        return NextResponse.json({ error: 'Gift not found' }, { status: 404 })
    }

    if (gift.user_id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error } = await supabase.from('guest_gifts').delete().eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ deleted: true })
}
