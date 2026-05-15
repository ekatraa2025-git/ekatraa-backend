import { NextResponse } from 'next/server'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'

const SARVAM_STT_URL = process.env.SARVAM_STT_URL?.trim() || 'https://api.sarvam.ai/speech-to-text'
const MAX_AUDIO_BYTES = 12 * 1024 * 1024
/** Sarvam REST STT defaults per docs; `saaras:v3` requires `mode`. */
const DEFAULT_STT_MODEL = 'saarika:v2.5'

function summarizeSarvamError(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return ''
    const row = payload as Record<string, unknown>
    const err = row.error
    if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>
        if (typeof e.message === 'string' && e.message.trim()) return e.message.trim()
        if (typeof e.code === 'string' && e.code.trim()) return e.code.trim()
    }
    if (typeof row.message === 'string' && row.message.trim()) return row.message.trim()
    return ''
}

function resolveTranscript(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return ''
    const row = payload as Record<string, unknown>
    const candidates: unknown[] = [
        row.transcript,
        row.text,
        row.output,
        row.asr_text,
        row.transcription,
    ]
    for (const item of candidates) {
        if (typeof item === 'string' && item.trim()) return item.trim()
    }
    if (row.data && typeof row.data === 'object') {
        return resolveTranscript(row.data)
    }
    return ''
}

/**
 * Sarvam validates the upload part's MIME type against an allow-list.
 * Browsers often send `audio/webm; codecs=opus`, which is rejected — normalize to `audio/webm`.
 */
function normalizeFileMimeForSarvam(file: File): File {
    const raw = (file.type || '').trim().toLowerCase()
    if (!raw) return file

    let canonical: string | null = null
    if (raw.startsWith('audio/webm')) canonical = 'audio/webm'
    else if (raw.startsWith('video/webm')) canonical = 'video/webm'
    else if (raw.startsWith('audio/ogg') || raw.startsWith('audio/opus')) canonical = 'audio/ogg'
    else if (raw.startsWith('audio/mp4') || raw.startsWith('audio/x-m4a')) canonical = 'audio/mp4'
    else if (raw.startsWith('audio/mpeg') || raw.startsWith('audio/mp3') || raw.startsWith('audio/x-mp3'))
        canonical = 'audio/mpeg'
    else if (raw.startsWith('audio/wav') || raw.startsWith('audio/x-wav') || raw.startsWith('audio/wave'))
        canonical = 'audio/wav'
    else if (raw.startsWith('audio/aac') || raw.startsWith('audio/x-aac')) canonical = 'audio/aac'
    else if (raw.startsWith('audio/flac') || raw.startsWith('audio/x-flac')) canonical = 'audio/flac'
    else if (raw.startsWith('audio/amr')) canonical = 'audio/amr'
    else if (raw.startsWith('audio/x-ms-wma')) canonical = 'audio/x-ms-wma'

    if (!canonical || canonical === file.type) return file

    const name = file.name?.trim() || 'audio.webm'
    return new File([file], name, { type: canonical, lastModified: file.lastModified })
}

/** Sarvam enum `input_audio_codec` — helps some browsers (WebM/Opus). */
function guessInputAudioCodec(file: File): string | null {
    const name = (file.name || '').toLowerCase()
    const type = (file.type || '').toLowerCase()
    if (type.includes('webm')) return 'webm'
    if (type.includes('ogg')) return 'opus'
    if (type.includes('mp4') || type.includes('m4a')) return 'mp4'
    if (type.includes('wav')) return 'wav'
    if (type.includes('mpeg') || type.includes('mp3')) return 'mp3'
    if (name.endsWith('.webm')) return 'webm'
    if (name.endsWith('.m4a') || name.endsWith('.mp4')) return 'mp4'
    if (name.endsWith('.mp3')) return 'mp3'
    if (name.endsWith('.wav')) return 'wav'
    return null
}

export async function OPTIONS(req: Request) {
    return new NextResponse(null, { status: 204, headers: planningCorsHeaders(req) })
}

export async function POST(req: Request) {
    const cors = planningCorsHeaders(req)
    const key = process.env.SARVAM_API_KEY?.trim() || process.env.SARVAM_API_SUBSCRIPTION_KEY?.trim()
    if (!key) {
        return NextResponse.json(
            { error: 'Sarvam STT is not configured (missing SARVAM_API_KEY).' },
            { status: 503, headers: cors }
        )
    }

    let formData: FormData
    try {
        formData = await req.formData()
    } catch {
        return NextResponse.json(
            { error: 'Invalid multipart payload. Expected FormData with an audio file.' },
            { status: 400, headers: cors }
        )
    }

    const fileLike = formData.get('audio') || formData.get('file')
    if (!(fileLike instanceof File)) {
        return NextResponse.json(
            { error: 'Missing audio file. Use form-data key `audio` (or `file`).' },
            { status: 400, headers: cors }
        )
    }
    if (fileLike.size <= 0) {
        return NextResponse.json({ error: 'Audio file is empty.' }, { status: 400, headers: cors })
    }
    if (fileLike.size > MAX_AUDIO_BYTES) {
        return NextResponse.json(
            { error: `Audio file too large. Max ${MAX_AUDIO_BYTES} bytes.` },
            { status: 413, headers: cors }
        )
    }

    const languageCodeRaw = formData.get('language_code')
    const languageCode =
        typeof languageCodeRaw === 'string' && languageCodeRaw.trim() ? languageCodeRaw.trim().slice(0, 16) : 'en-IN'

    const modelRaw = formData.get('model')
    const modelFromClient = typeof modelRaw === 'string' && modelRaw.trim() ? modelRaw.trim().slice(0, 64) : ''
    const effectiveModel = modelFromClient || process.env.SARVAM_STT_MODEL?.trim() || DEFAULT_STT_MODEL
    const mode =
        typeof formData.get('mode') === 'string' && String(formData.get('mode')).trim()
            ? String(formData.get('mode')).trim().slice(0, 32)
            : process.env.SARVAM_STT_MODE?.trim() || 'transcribe'

    const sarvamFile = normalizeFileMimeForSarvam(fileLike)

    const upstreamBody = new FormData()
    upstreamBody.set('file', sarvamFile, sarvamFile.name || 'audio.webm')
    upstreamBody.set('language_code', languageCode)
    upstreamBody.set('model', effectiveModel)
    if (effectiveModel.toLowerCase().includes('saaras:v3')) {
        upstreamBody.set('mode', mode)
    }
    const codec = guessInputAudioCodec(sarvamFile)
    if (codec) {
        upstreamBody.set('input_audio_codec', codec)
    }

    const upstream = await fetch(SARVAM_STT_URL, {
        method: 'POST',
        headers: {
            'api-subscription-key': key,
        },
        body: upstreamBody,
    })

    const contentType = upstream.headers.get('content-type') || ''
    let upstreamPayload: unknown = null
    if (contentType.includes('application/json')) {
        upstreamPayload = await upstream.json().catch(() => null)
    } else {
        const txt = await upstream.text().catch(() => '')
        upstreamPayload = txt ? { raw_text: txt.slice(0, 1000) } : null
    }

    if (!upstream.ok) {
        const upstreamMessage = summarizeSarvamError(upstreamPayload)
        return NextResponse.json(
            {
                error: 'Sarvam STT request failed',
                ...(upstreamMessage ? { message: upstreamMessage } : {}),
                detail: upstreamPayload,
            },
            { status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, headers: cors }
        )
    }

    const transcript = resolveTranscript(upstreamPayload)
    if (!transcript) {
        return NextResponse.json(
            {
                error: 'Sarvam STT response did not include transcript text.',
                detail: upstreamPayload,
            },
            { status: 502, headers: cors }
        )
    }

    return NextResponse.json(
        {
            transcript,
            language_code: languageCode,
            provider: 'sarvam',
            model: effectiveModel,
            raw: upstreamPayload,
        },
        { headers: cors }
    )
}
