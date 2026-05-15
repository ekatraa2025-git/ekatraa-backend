import { NextResponse } from 'next/server'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'
<<<<<<< HEAD
=======
import { toSpeechSafeText } from '@/lib/voice-text'
import { z } from 'zod'
>>>>>>> 6ce4ae0 (Vendor Deletion fixes)

const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech/stream'

/**
 * Bulbul v2-only speakers (Sarvam docs). Pairing these with `bulbul:v3` yields 4xx from the API.
 * v3 voices are a different set (e.g. priya, shubh); "anushka" is v2 female default only.
 */
const BULBUL_V2_ONLY_FEMALE = new Set(['anushka', 'manisha', 'vidya', 'arya'])
const BULBUL_V2_ONLY_MALE = new Set(['abhilash', 'karun', 'hitesh'])

function resolveSpeakerForModel(speaker: string, model: string): string {
    const m = model.toLowerCase()
    if (!m.includes('bulbul:v3')) return speaker
    if (BULBUL_V2_ONLY_FEMALE.has(speaker)) return 'priya'
    if (BULBUL_V2_ONLY_MALE.has(speaker)) return 'shubh'
    return speaker
}

<<<<<<< HEAD
/** Strip markdown-ish noise and cart payload tail for natural speech. */
function textForTts(raw: string): string {
    const noCart = raw.replace(/(?:^|\n)CART_ACTIONS:(\{[\s\S]*\})\s*$/m, '').trim()
    return noCart
        .replace(/\*\*?|__|`+/g, ' ')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3500)
}
=======
const bodySchema = z.object({
    text: z.string().min(1).max(16000),
    response_format: z.enum(['stream', 'base64']).optional(),
    target_language_code: z.string().trim().min(2).max(16).optional(),
    pace: z.number().min(0.5).max(2).optional(),
    speaker: z.string().trim().min(2).max(40).optional(),
    model: z.string().trim().min(2).max(40).optional(),
})
>>>>>>> 6ce4ae0 (Vendor Deletion fixes)

/**
 * Proxy Sarvam streaming TTS (Bulbul). API key stays on the server — use SARVAM_API_KEY.
 *
 * POST JSON: { text: string }
 * Response: audio/mpeg stream (or Sarvam error JSON).
 *
 * Optional env: SARVAM_TTS_SPEAKER (default priya for bulbul:v3, anushka for v2), SARVAM_TTS_MODEL (default bulbul:v3)
 */
export async function OPTIONS(req: Request) {
    return new NextResponse(null, { status: 204, headers: planningCorsHeaders(req) })
}

export async function POST(req: Request) {
    const cors = planningCorsHeaders(req)
    const key = process.env.SARVAM_API_KEY?.trim() || process.env.SARVAM_API_SUBSCRIPTION_KEY?.trim()
    if (!key) {
        return NextResponse.json(
            { error: 'Sarvam TTS is not configured (missing SARVAM_API_KEY).' },
            { status: 503, headers: cors }
        )
    }

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: cors })
    }

<<<<<<< HEAD
    const textIn = typeof (body as { text?: unknown }).text === 'string' ? (body as { text: string }).text : ''
    const text = textForTts(textIn)
=======
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400, headers: cors })
    }

    const text = toSpeechSafeText(parsed.data.text, 3500)
>>>>>>> 6ce4ae0 (Vendor Deletion fixes)
    if (!text) {
        return NextResponse.json({ error: 'Missing or empty text after cleanup' }, { status: 400, headers: cors })
    }

<<<<<<< HEAD
    const model = (process.env.SARVAM_TTS_MODEL || 'bulbul:v3').trim()
    const rawSpeaker = (process.env.SARVAM_TTS_SPEAKER || '').trim().toLowerCase()
    const defaultSpeaker = model.toLowerCase().includes('bulbul:v3') ? 'priya' : 'anushka'
    const speaker = resolveSpeakerForModel(rawSpeaker || defaultSpeaker, model)
=======
    const model = (parsed.data.model || process.env.SARVAM_TTS_MODEL || 'bulbul:v3').trim()
    const rawSpeaker = (parsed.data.speaker || process.env.SARVAM_TTS_SPEAKER || '').trim().toLowerCase()
    const defaultSpeaker = model.toLowerCase().includes('bulbul:v3') ? 'priya' : 'anushka'
    const speaker = resolveSpeakerForModel(rawSpeaker || defaultSpeaker, model)
    const responseFormat = parsed.data.response_format || 'stream'
    const targetLanguageCode = parsed.data.target_language_code || 'en-IN'
    const pace = parsed.data.pace || 1
>>>>>>> 6ce4ae0 (Vendor Deletion fixes)

    const isV3 = model.toLowerCase().includes('bulbul:v3')
    const payload: Record<string, unknown> = {
        text,
<<<<<<< HEAD
        target_language_code: 'en-IN',
        speaker,
        pace: 1,
=======
        target_language_code: targetLanguageCode,
        speaker,
        pace,
>>>>>>> 6ce4ae0 (Vendor Deletion fixes)
        model,
        output_audio_codec: 'mp3',
        output_audio_bitrate: '128k',
    }
    if (isV3) {
        payload.temperature = 0.6
    } else {
        payload.enable_preprocessing = false
    }

    const upstream = await fetch(SARVAM_TTS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-subscription-key': key,
        },
        body: JSON.stringify(payload),
    })

    if (!upstream.ok) {
        const errText = await upstream.text().catch(() => '')
        return NextResponse.json(
            { error: 'Sarvam TTS request failed', detail: errText.slice(0, 500) },
            { status: upstream.status >= 400 ? upstream.status : 502, headers: cors }
        )
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg'
<<<<<<< HEAD
=======
    if (responseFormat === 'base64') {
        const buf = Buffer.from(await upstream.arrayBuffer())
        return NextResponse.json(
            {
                audio_base64: buf.toString('base64'),
                mime_type: contentType,
                provider: 'sarvam',
                model,
                speaker,
                text,
            },
            { headers: cors }
        )
    }
>>>>>>> 6ce4ae0 (Vendor Deletion fixes)

    return new NextResponse(upstream.body, {
        headers: {
            ...cors,
            'Content-Type': contentType,
            'Cache-Control': 'no-store',
        },
    })
}
