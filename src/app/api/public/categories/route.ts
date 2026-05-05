import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'
import { NextResponse } from 'next/server'

async function signCategoryMedia(row: Record<string, unknown>) {
    const iconRaw = typeof row.icon_url === 'string' ? row.icon_url : null
    const videoRaw = typeof row.video_url === 'string' ? row.video_url : null
    const [iconSigned, videoSigned] = await Promise.all([
        signedUrlForStorageRef(iconRaw),
        signedUrlForStorageRef(videoRaw),
    ])
    return {
        ...row,
        icon_url: iconSigned ?? iconRaw ?? null,
        video_url: videoSigned ?? videoRaw ?? null,
    }
}

/**
 * GET /api/public/categories?occasion_id=
 * Returns categories for the new flow, optionally filtered by occasion (via occasion_categories).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const occasionId = searchParams.get('occasion_id')

    if (occasionId) {
        const { data, error } = await supabase
            .from('occasion_categories')
            .select('category_id, display_order, categories(id, name, icon_url, video_url, display_order)')
            .eq('occasion_id', occasionId)
            .order('display_order', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }
        type CatRow = { display_order: number | null; categories: unknown }
        const list = (data ?? [])
            .map((row: CatRow) => {
                const c = row.categories
                const cat = Array.isArray(c) ? c[0] : c
                if (!cat || typeof cat !== 'object') return null
                const order = Number(row.display_order) || 0
                return { ...(cat as Record<string, unknown>), _occCatOrder: order }
            })
            .filter((x): x is Record<string, unknown> & { _occCatOrder: number } => x != null)
            .sort((a, b) => a._occCatOrder - b._occCatOrder)
            .map(({ _occCatOrder: _removed, ...rest }) => rest)
        const signed = await Promise.all(list.map((r) => signCategoryMedia(r)))
        return NextResponse.json(signed)
    }

    const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon_url, video_url, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const rows = Array.isArray(data) ? data : []
    const signed = await Promise.all(rows.map((r) => signCategoryMedia(r as Record<string, unknown>)))
    return NextResponse.json(signed)
}
