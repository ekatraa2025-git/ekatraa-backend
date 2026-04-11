import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const sectionKey = searchParams.get('section_key')?.trim() || null
    const limitRaw = Number(searchParams.get('limit') || 60)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 60

    let query = supabase
        .from('e_invite_templates')
        .select(
            'id, section_key, title, subtitle, thumbnail_url, preview_url, template_type, duration_seconds, price, list_price, currency, display_order'
        )
        .eq('is_active', true)
        .order('section_key', { ascending: true })
        .order('display_order', { ascending: true })
        .limit(limit)

    if (sectionKey) query = query.eq('section_key', sectionKey)

    const { data, error } = await query
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data ?? []
    const resolved = await Promise.all(
        rows.map(async (row: { thumbnail_url?: string | null; [k: string]: unknown }) => {
            const signedThumb = await signedUrlForStorageRef(row.thumbnail_url ?? null)
            return {
                ...row,
                thumbnail_url: signedThumb ?? row.thumbnail_url ?? null,
            }
        })
    )
    return NextResponse.json(resolved)
}
