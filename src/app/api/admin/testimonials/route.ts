import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    const { data, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('display_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const row = {
            display_name: body.display_name,
            testimonial_text: body.testimonial_text ?? null,
            video_url: body.video_url ?? null,
            voice_recording_url: body.voice_recording_url ?? null,
            image_url: body.image_url ?? null,
            display_order: body.display_order ?? 0,
            is_active: body.is_active !== false,
        }
        if (!row.display_name || typeof row.display_name !== 'string') {
            return NextResponse.json({ error: 'display_name is required' }, { status: 400 })
        }

        const { data, error } = await supabase.from('testimonials').insert([row]).select().single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json(data, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
