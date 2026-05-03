import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase/server'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { generateImageWithOpenRouter } from '@/lib/openrouter-client'
import { priceInrForMediaKind, type EInviteMediaKind } from '@/lib/e-invite-pricing'
import { buildEInviteImagePrompt } from '@/lib/e-invite-prompt'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'
import { buildGifFromPngBuffers } from '@/lib/e-invite-gif'

const BUCKET = 'ekatraa2025'

async function imageRefToBuffer(ref: string): Promise<Buffer> {
    const r = String(ref || '').trim()
    if (!r) throw new Error('Empty image reference')
    if (r.startsWith('data:')) {
        const idx = r.indexOf('base64,')
        if (idx === -1) throw new Error('Invalid data URL')
        return Buffer.from(r.slice(idx + 7), 'base64')
    }
    const res = await fetch(r)
    if (!res.ok) throw new Error('Could not download generated image')
    return Buffer.from(await res.arrayBuffer())
}

type DesignBody = {
    color_theme?: string
    variation?: string
    font_style?: string
    sticker_pack?: string
}

export async function POST(req: Request) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const body = await req.json().catch(() => ({}))
        const occasion = String(body.occasion || 'Celebration').trim()
        const rawMedia = String(body.media_type || 'image').toLowerCase()
        const mediaKind: EInviteMediaKind = rawMedia === 'animated' ? 'animated' : 'static'
        const userPrompt = String(body.prompt || '').trim()
        const eventName = String(body.event_name || '').trim()
        if (!eventName) {
            return NextResponse.json({ error: 'event_name is required' }, { status: 400 })
        }
        if (!userPrompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
        }

        const hostNames = String(body.host_names || '').trim()
        const eventDate = String(body.event_date || '').trim()
        const eventTime = String(body.event_time || '').trim()
        const venue = String(body.venue || '').trim()

        const design: DesignBody =
            body.design && typeof body.design === 'object' ? (body.design as DesignBody) : {}

        const settings = await getAiRuntimeSettings()
        const imageModel = settings.openrouterImageModel
        const animModel = settings.openrouterInviteAnimatedModel

        const sessionId = `e-inv-gen-${userId}-${Date.now()}`

        const baseArgs = {
            occasion,
            userPrompt,
            eventName,
            hostNames: hostNames || undefined,
            eventDate: eventDate || undefined,
            eventTime: eventTime || undefined,
            venue: venue || undefined,
            design,
        }

        let storagePath: string
        let uploadBody: Buffer
        let contentType: string

        if (mediaKind === 'static') {
            const prompt = buildEInviteImagePrompt({
                ...baseArgs,
                compositionHint:
                    'Single static frame — rich shadows, subtle paper texture, magazine finish.',
            })
            const { imageRef } = await generateImageWithOpenRouter({
                model: imageModel,
                prompt,
                sessionId,
            })
            uploadBody = await imageRefToBuffer(imageRef)
            contentType = 'image/png'
            storagePath = `e-invites/${userId}/${randomUUID()}.png`
        } else {
            const prompt1 = buildEInviteImagePrompt({
                ...baseArgs,
                compositionHint:
                    'Frame 1 of 2 for a gentle GIF loop — establish composition, typography, and lighting baseline.',
            })
            const prompt2 = buildEInviteImagePrompt({
                ...baseArgs,
                compositionHint:
                    'Frame 2 of 2 — same layout and palette as frame 1; subtly shift lights, confetti, or depth for a soft celebratory motion when looped.',
            })

            const [{ imageRef: ref1 }, { imageRef: ref2 }] = await Promise.all([
                generateImageWithOpenRouter({ model: imageModel, prompt: prompt1, sessionId }),
                generateImageWithOpenRouter({ model: animModel, prompt: prompt2, sessionId }),
            ])
            const buf1 = await imageRefToBuffer(ref1)
            const buf2 = await imageRefToBuffer(ref2)
            let gifBuf: Buffer
            try {
                gifBuf = await buildGifFromPngBuffers([buf1, buf2])
            } catch {
                gifBuf = await buildGifFromPngBuffers([buf1, buf1])
            }
            uploadBody = gifBuf
            contentType = 'image/gif'
            storagePath = `e-invites/${userId}/${randomUUID()}.gif`
        }

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, uploadBody, {
            contentType,
            upsert: false,
        })
        if (upErr) {
            return NextResponse.json({ error: upErr.message || 'Storage upload failed' }, { status: 500 })
        }

        const priceInr = priceInrForMediaKind(mediaKind)
        const combinedPrompt = buildEInviteImagePrompt({
            ...baseArgs,
        })

        const formPayload = {
            occasion,
            media_type: rawMedia,
            event_name: eventName,
            host_names: hostNames,
            event_date: eventDate,
            event_time: eventTime,
            venue,
            design,
            prompt: userPrompt,
        }

        const { data: row, error: insErr } = await supabase
            .from('user_e_invites')
            .insert({
                user_id: userId,
                media_kind: mediaKind,
                storage_path: storagePath,
                price_inr: priceInr,
                payment_status: 'unpaid',
                prompt: combinedPrompt,
                form_payload: formPayload,
            })
            .select('id, payment_status, price_inr, media_kind')
            .single()

        if (insErr || !row) {
            return NextResponse.json({ error: insErr?.message || 'Could not save invite record' }, { status: 500 })
        }

        const mediaUrl = await signedUrlForStorageRef(storagePath)

        return NextResponse.json({
            user_e_invite_id: row.id,
            media_url: mediaUrl,
            storage_path: storagePath,
            payment_status: row.payment_status,
            price_inr: row.price_inr,
            media_kind: row.media_kind,
            prompt: combinedPrompt,
        })
    } catch (e) {
        const msg = (e as Error)?.message || String(e)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
