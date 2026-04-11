import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { id } = await params
    const { data, error } = await supabase
        .from('e_invite_faqs')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !data) {
        return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 })
    }
    return NextResponse.json(data)
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    try {
        const { id } = await params
        const body = await req.json()
        const patch: Record<string, unknown> = {}

        if (body.question !== undefined) {
            const question = String(body.question || '').trim()
            if (!question) return NextResponse.json({ error: 'question cannot be empty' }, { status: 400 })
            patch.question = question
        }
        if (body.answer !== undefined) {
            const answer = String(body.answer || '').trim()
            if (!answer) return NextResponse.json({ error: 'answer cannot be empty' }, { status: 400 })
            patch.answer = answer
        }
        if (body.display_order !== undefined) patch.display_order = Number(body.display_order || 0)
        if (body.is_active !== undefined) patch.is_active = body.is_active !== false
        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: 'No patch fields provided' }, { status: 400 })
        }

        patch.updated_at = new Date().toISOString()

        const { data, error } = await supabase
            .from('e_invite_faqs')
            .update(patch)
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { id } = await params
    const { error } = await supabase.from('e_invite_faqs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
}
