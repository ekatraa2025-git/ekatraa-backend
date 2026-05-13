import { NextResponse } from 'next/server'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'

const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech/stream'

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
 * Optional env: SARVAM_TTS_SPEAKER (default anushka), SARVAM_TTS_MODEL (default bulbul:v3)
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

    const speaker = (process.env.SARVAM_TTS_SPEAKER || 'anushka').trim().toLowerCase()
    const model = (process.env.SARVAM_TTS_MODEL || 'bulbul:v3').trim()

    const payload = {
        text,
        target_language_code: 'en-IN',
        speaker,
        pace: 1,
        model,
        temperature: 0.6,
        enable_preprocessing: false,
        output_audio_codec: 'mp3',
        output_audio_bitrate: '128k',
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
