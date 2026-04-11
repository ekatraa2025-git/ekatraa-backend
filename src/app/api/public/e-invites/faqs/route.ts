import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const limitRaw = Number(searchParams.get('limit') || 50)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50

    const { data, error } = await supabase
        .from('e_invite_faqs')
        .select('id, question, answer, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(limit)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
}
