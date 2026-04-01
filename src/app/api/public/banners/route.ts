import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

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

    const resolved = await Promise.all(
        filtered.map(async (b: { image_url?: string }) => {
            const signedUrl = await signedUrlForStorageRef(b.image_url)
            return { ...b, image_url: signedUrl ?? b.image_url }
        })
    )

    return NextResponse.json(resolved)
}
