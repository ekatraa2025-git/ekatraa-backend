import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'

export async function GET() {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { data, error } = await supabase
        .from('e_invite_faqs')
        .select('*')
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
            question: String(body.question || '').trim(),
            answer: String(body.answer || '').trim(),
            display_order:
                body.display_order != null ? Number(body.display_order) : 0,
            is_active: body.is_active !== false,
        }
        if (!row.question || !row.answer) {
            return NextResponse.json(
                { error: 'question and answer are required' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('e_invite_faqs')
            .insert([row])
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
