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
        .from('e_invite_templates')
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

        if (body.section_key !== undefined) {
            const sectionKey = String(body.section_key || '').trim()
            if (!sectionKey) {
                return NextResponse.json({ error: 'section_key cannot be empty' }, { status: 400 })
            }
            patch.section_key = sectionKey
        }
        if (body.title !== undefined) {
            const title = String(body.title || '').trim()
            if (!title) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
            patch.title = title
        }
        if (body.subtitle !== undefined) patch.subtitle = body.subtitle ? String(body.subtitle) : null
        if (body.thumbnail_url !== undefined) patch.thumbnail_url = body.thumbnail_url ? String(body.thumbnail_url) : null
        if (body.preview_url !== undefined) patch.preview_url = body.preview_url ? String(body.preview_url) : null
        if (body.template_type !== undefined) patch.template_type = body.template_type ? String(body.template_type) : 'image'
        if (body.duration_seconds !== undefined) patch.duration_seconds = body.duration_seconds != null ? Number(body.duration_seconds) : null
        if (body.price !== undefined) patch.price = body.price != null ? Number(body.price) : null
        if (body.list_price !== undefined) patch.list_price = body.list_price != null ? Number(body.list_price) : null
        if (body.currency !== undefined) patch.currency = body.currency ? String(body.currency) : 'INR'
        if (body.display_order !== undefined) patch.display_order = Number(body.display_order || 0)
        if (body.is_active !== undefined) patch.is_active = body.is_active !== false

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: 'No patch fields provided' }, { status: 400 })
        }

        patch.updated_at = new Date().toISOString()

        const { data, error } = await supabase
            .from('e_invite_templates')
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
    const { error } = await supabase.from('e_invite_templates').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
}
