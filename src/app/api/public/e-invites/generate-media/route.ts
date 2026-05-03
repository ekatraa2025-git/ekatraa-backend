import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'ekatraa2025'
const GENERATED_INVITE_SIGNED_SEC = 60 * 60 * 24 * 30

type Body = {
    occasion?: string
    media_type?: 'image' | 'animated'
    prompt?: string
    event_name?: string
    host_names?: string
    event_date?: string
    event_time?: string
    venue?: string
}

function jsonError(message: string, status: number) {
    return NextResponse.json({ error: message }, { status })
}

function cleanText(v: unknown, max = 800) {
    return String(v || '').trim().slice(0, max)
}

function buildPrompt(body: Body) {
    const occasion = cleanText(body.occasion || 'Wedding', 80)
    const mediaType = body.media_type === 'animated' ? 'animated' : 'image'
    const prompt = cleanText(body.prompt, 1200)
    const eventName = cleanText(body.event_name, 120)
    const hosts = cleanText(body.host_names, 160)
    const date = cleanText(body.event_date, 80)
    const time = cleanText(body.event_time, 80)
    const venue = cleanText(body.venue, 220)

    return [
        `Create a premium Indian ${occasion} e-invitation ${mediaType === 'animated' ? 'animated poster keyframe' : 'card image'}.`,
        'High-end festive design, elegant typography space, ornate but readable, mobile-first vertical composition, no distorted text.',
        mediaType === 'animated'
            ? 'Make it look like a cinematic animated invite frame with soft motion trails, glowing particles, and celebratory depth.'
            : 'Make it look like a polished printable digital invite image with layered decorative details.',
        eventName ? `Event title: ${eventName}.` : '',
        hosts ? `Host names: ${hosts}.` : '',
        date || time ? `Date/time context: ${[date, time].filter(Boolean).join(' at ')}.` : '',
        venue ? `Venue context: ${venue}.` : '',
        prompt ? `User creative direction: ${prompt}.` : '',
        'Style must be culturally appropriate for India and suitable for WhatsApp sharing.',
    ]
        .filter(Boolean)
        .join(' ')
}

export async function POST(req: Request) {
    const workerUrl = String(process.env.CLOUDFLARE_INVITE_IMAGE_WORKER_URL || '').trim()
    const workerKey = String(process.env.CLOUDFLARE_INVITE_IMAGE_WORKER_API_KEY || '').trim()
    if (!workerUrl || !workerKey) {
        return jsonError('Cloudflare invite image worker is not configured', 500)
    }

    let body: Body
    try {
        body = (await req.json()) as Body
    } catch {
        return jsonError('Invalid JSON', 400)
    }

    const prompt = buildPrompt(body)
    if (!prompt.trim()) return jsonError('Prompt is required', 400)

    const res = await fetch(workerUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${workerKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
    })

    if (!res.ok) {
        const errText = await res.text().catch(() => '')
        return jsonError(errText || 'Cloudflare image generation failed', res.status)
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg'
    const bytes = Buffer.from(await res.arrayBuffer())
    const path = `e-invites/generated/${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType,
        upsert: false,
    })

    if (uploadError) {
        return jsonError(uploadError.message || 'Could not save generated invite', 500)
    }

    const { data: signedData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, GENERATED_INVITE_SIGNED_SEC)
    return NextResponse.json({
        media_url: signedData?.signedUrl ?? null,
        storage_path: path,
        content_type: contentType,
        prompt,
        media_type: body.media_type === 'animated' ? 'animated' : 'image',
    })
}
