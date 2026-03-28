import { supabase } from '@/lib/supabase/server'
import { resolveStorageImageUrl } from '@/lib/resolve-storage-image-url'
import { NextResponse } from 'next/server'

export async function GET() {
    const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const now = new Date().toISOString()
    const filtered = (data || []).filter(
        (b: { start_date?: string; end_date?: string }) =>
            (!b.start_date || b.start_date <= now) &&
            (!b.end_date || b.end_date >= now)
    )

    const withImages = await Promise.all(
        filtered.map(async (b: { image_url?: string | null; [k: string]: unknown }) => {
            const image_url = await resolveStorageImageUrl(supabase, b.image_url ?? null)
            return { ...b, image_url }
        })
    )

    return NextResponse.json(withImages)
}
