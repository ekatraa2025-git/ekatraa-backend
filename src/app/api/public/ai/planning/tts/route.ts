import { NextResponse } from 'next/server'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'

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

    const textIn = typeof (body as { text?: unknown }).text === 'string' ? (body as { text: string }).text : ''
    const text = textForTts(textIn)
    if (!text) {
        return NextResponse.json({ error: 'Missing or empty text after cleanup' }, { status: 400, headers: cors })
    }

    const model = (process.env.SARVAM_TTS_MODEL || 'bulbul:v3').trim()
    const rawSpeaker = (process.env.SARVAM_TTS_SPEAKER || '').trim().toLowerCase()
    const defaultSpeaker = model.toLowerCase().includes('bulbul:v3') ? 'priya' : 'anushka'
    const speaker = resolveSpeakerForModel(rawSpeaker || defaultSpeaker, model)

    const isV3 = model.toLowerCase().includes('bulbul:v3')
    const payload: Record<string, unknown> = {
        text,
        target_language_code: 'en-IN',
        speaker,
        pace: 1,
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

    return new NextResponse(upstream.body, {
        headers: {
            ...cors,
            'Content-Type': contentType,
            'Cache-Control': 'no-store',
        },
    })
}
