import { supabase } from '@/lib/supabase/server'
import { resolveStorageImageUrl } from '@/lib/resolve-storage-image-url'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/testimonials
 * Active testimonials for the home screen (name, text, video, voice, image).
 * image_url is returned as a signed HTTP URL (DB stores bucket paths like testimonials/…).
 */
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('testimonials')
            .select(
                'id, display_name, testimonial_text, video_url, voice_recording_url, image_url, display_order'
            )
            .eq('is_active', true)
            .order('display_order', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const rows = data ?? []
        const withImages = await Promise.all(
            rows.map(async (row: { image_url?: string | null; [k: string]: unknown }) => {
                const image_url = await resolveStorageImageUrl(supabase, row.image_url ?? null)
                return { ...row, image_url }
            })
        )

        return NextResponse.json(withImages)
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
