import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { generateImageWithOpenRouter } from '@/lib/openrouter-client'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { composeGifFromImageBuffers } from '@/lib/e-invite-gif'
import { priceInrForMediaKind, type EInviteMediaKind } from '@/lib/e-invite-pricing'

const BUCKET = 'ekatraa2025'

function sanitizeSegment(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9-_./]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
}

async function bufferFromImageRef(ref: string): Promise<{ buffer: Buffer; contentType: string }> {
    const s = ref.trim()
    if (s.startsWith('data:')) {
        const m = s.match(/^data:([^;]+);base64,(.+)$/i)
        if (!m) throw new Error('Invalid image data URL')
        return { buffer: Buffer.from(m[2], 'base64'), contentType: m[1] || 'image/png' }
    }
    if (s.startsWith('http://') || s.startsWith('https://')) {
        const r = await fetch(s, { cache: 'no-store' })
        if (!r.ok) throw new Error('Could not download generated image')
        const ct = r.headers.get('content-type') || 'image/png'
        const buf = Buffer.from(await r.arrayBuffer())
        if (!buf.length) throw new Error('Empty image bytes')
        return { buffer: buf, contentType: ct }
    }
    throw new Error('Unsupported image reference')
}

function parseDesignPayload(body: Record<string, unknown>): Record<string, unknown> {
    const d = body.design && typeof body.design === 'object' ? (body.design as Record<string, unknown>) : {}
    return {
        color_theme: String(d.color_theme ?? body.color_theme ?? '').trim() || null,
        font_style: String(d.font_style ?? body.font_style ?? '').trim() || null,
        sticker_pack: String(d.sticker_pack ?? body.sticker_pack ?? '').trim() || null,
        layout_variation: String(d.layout_variation ?? body.layout_variation ?? '').trim() || null,
    }
}

function buildCreativePrompt(base: string, design: Record<string, unknown>): string {
    const parts: string[] = [base]
    const c = design.color_theme ? `Colour direction: ${design.color_theme}.` : ''
    const f = design.font_style ? `Typography / font personality: ${design.font_style}.` : ''
    const s = design.sticker_pack ? `Decorative motifs and stickers to include: ${design.sticker_pack}.` : ''
    const v = design.layout_variation ? `Layout vibe: ${design.layout_variation}.` : ''
    if (c) parts.push(c)
    if (f) parts.push(f)
    if (s) parts.push(s)
    if (v) parts.push(v)
    return parts.join('\n')
}

export async function POST(req: Request) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const body = await req.json().catch(() => ({}))
        const prompt = String(body.prompt || '').trim()
        if (!prompt || prompt.length < 8) {
            return NextResponse.json({ error: 'prompt is required (min 8 chars)' }, { status: 400 })
        }
        if (prompt.length > 12000) {
            return NextResponse.json({ error: 'prompt is too long' }, { status: 400 })
        }

        const occasion = String(body.occasion || 'event').trim()
        const eventName = String(body.event_name || body.eventName || '').trim()
        const rawMedia = String(body.media_type || 'image').toLowerCase()
        const mediaKind: EInviteMediaKind =
            rawMedia === 'animated' || rawMedia === 'gif' || rawMedia === 'video' ? 'animated' : 'static'

        const design = parseDesignPayload(body as Record<string, unknown>)
        const settings = await getAiRuntimeSettings()
        const staticModel = settings.openrouterImageModel
        const animatedModel = settings.openrouterInviteAnimatedModel
        const model = mediaKind === 'animated' ? animatedModel : staticModel
        const price_inr = priceInrForMediaKind(mediaKind)

        const lines: string[] = [
            'Create a polished digital event invitation design suitable for mobile sharing (e.g. WhatsApp).',
            'High quality composition; readable headline text where appropriate; festive elegance; no watermarks; no browser or app UI chrome.',
            `Occasion: ${occasion}.`,
        ]
        if (eventName) lines.push(`Event name (may appear on the design): ${eventName}.`)
        lines.push('Creative direction from the host:')
        lines.push(buildCreativePrompt(prompt, design))

        if (mediaKind === 'animated') {
            lines.push(
                'This is frame 1 of a short looping invite animation — strong readable focal, leave subtle room for motion in sequels (sparkles, light shifts, confetti).'
            )
        }

        let fullPrompt = lines.join('\n')
        const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : ''

        const runGen = async (p: string) => {
            try {
                return await generateImageWithOpenRouter({
                    model,
                    prompt: p,
                    sessionId: sessionId || undefined,
                    imageConfig: { aspect_ratio: '3:4' },
                })
            } catch {
                return generateImageWithOpenRouter({
                    model,
                    prompt: p,
                    sessionId: sessionId || undefined,
                })
            }
        }

        let finalBuffer: Buffer
        let contentType: string
        let ext: string
        let modelUsed = model

        if (mediaKind === 'animated') {
            const p2 = fullPrompt.replace(
                'frame 1 of a short looping',
                'frame 2 of the same looping invite — evolve motion: slightly more sparkle, confetti, or light bloom while keeping layout consistent'
            )
            const [frame1, frame2] = await Promise.all([runGen(fullPrompt), runGen(p2)])
            const b1 = await bufferFromImageRef(frame1.imageRef)
            const b2 = await bufferFromImageRef(frame2.imageRef)
            modelUsed = `${model} (2 frames)`
            try {
                finalBuffer = await composeGifFromImageBuffers([b1.buffer, b2.buffer])
                contentType = 'image/gif'
                ext = 'gif'
            } catch {
                finalBuffer = b1.buffer
                contentType = b1.contentType.split(';')[0] || 'image/png'
                ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png'
            }
        } else {
            const imageRefResult = await runGen(fullPrompt)
            const { imageRef } = imageRefResult
            const parsed = await bufferFromImageRef(imageRef)
            finalBuffer = parsed.buffer
            contentType = parsed.contentType.split(';')[0] || 'image/png'
            ext =
                contentType.includes('jpeg') || contentType.includes('jpg')
                    ? 'jpg'
                    : contentType.includes('webp')
                      ? 'webp'
                      : 'png'
        }

        const slug = sanitizeSegment(eventName || occasion || 'invite')
        const path = `e-invites/generated/${userId}/${Date.now()}-${slug}.${ext}`

        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, finalBuffer, {
            contentType,
            upsert: false,
        })
        if (uploadErr) {
            return NextResponse.json({ error: uploadErr.message || 'Storage upload failed' }, { status: 500 })
        }

        const formPayload = {
            occasion,
            event_name: eventName,
            host_names: String(body.host_names || '').trim() || null,
            event_date: String(body.event_date || '').trim() || null,
            event_time: String(body.event_time || '').trim() || null,
            venue: String(body.venue || '').trim() || null,
            invitation_message: String(body.invitation_message ?? body.message ?? '').trim() || null,
            media_kind: mediaKind,
            design,
        }

        const { data: row, error: insErr } = await supabase
            .from('user_e_invites')
            .insert({
                user_id: userId,
                media_kind: mediaKind,
                status: 'awaiting_payment',
                price_inr,
                storage_path: path,
                form_payload: formPayload,
                prompt_used: fullPrompt,
                model_used: modelUsed,
            })
            .select('id')
            .single()

        if (insErr || !row?.id) {
            return NextResponse.json({ error: insErr?.message || 'Could not save invite record' }, { status: 500 })
        }

        const media_url = await signedUrlForStorageRef(path)
        if (!media_url) {
            return NextResponse.json({ error: 'Could not sign storage URL' }, { status: 500 })
        }

        return NextResponse.json({
            user_e_invite_id: row.id,
            media_url,
            storage_path: path,
            prompt_used: fullPrompt,
            model_used: modelUsed,
            media_kind: mediaKind,
            price_inr,
            payment_status: 'awaiting_payment',
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Generation failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
