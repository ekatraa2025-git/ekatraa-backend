import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'

export async function GET() {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { data, error } = await supabase
        .from('e_invite_templates')
        .select('*')
        .order('section_key', { ascending: true })
        .order('display_order', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    try {
        const body = await req.json()
        const row = {
            section_key: String(body.section_key || '').trim(),
            title: String(body.title || '').trim(),
            subtitle: body.subtitle ? String(body.subtitle) : null,
            thumbnail_url: body.thumbnail_url ? String(body.thumbnail_url) : null,
            preview_url: body.preview_url ? String(body.preview_url) : null,
            template_type: body.template_type ? String(body.template_type) : 'image',
            duration_seconds:
                body.duration_seconds != null ? Number(body.duration_seconds) : null,
            price: body.price != null ? Number(body.price) : null,
            list_price: body.list_price != null ? Number(body.list_price) : null,
            currency: body.currency ? String(body.currency) : 'INR',
            display_order:
                body.display_order != null ? Number(body.display_order) : 0,
            is_active: body.is_active !== false,
        }

        if (!row.section_key || !row.title) {
            return NextResponse.json(
                { error: 'section_key and title are required' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('e_invite_templates')
            .insert([row])
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
