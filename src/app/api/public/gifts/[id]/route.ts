import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/public/gifts/[id]
 */
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Gift id required' }, { status: 400 })
    }

    const { error } = await supabase.from('guest_gifts').delete().eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ deleted: true })
}
