import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/testimonials
 * Active testimonials for the home screen (name, text, video, voice, image).
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

        return NextResponse.json(data ?? [])
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
