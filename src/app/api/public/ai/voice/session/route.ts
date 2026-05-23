import { NextResponse } from 'next/server'
import { z } from 'zod'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'

const bodySchema = z.object({
    agent: z.enum(['customer', 'vendor']).optional(),
    thread_id: z.string().optional(),
    voice_target_language_code: z.string().optional(),
})

function resolvePipecatBaseUrl(): string {
    const explicit = process.env.PIPECAT_SERVICE_URL?.trim()
    if (explicit) return explicit.replace(/\/$/, '')
    const host = process.env.PIPECAT_SERVICE_HOST?.trim() || 'http://localhost:7860'
    return host.replace(/\/$/, '')
}

function resolveBackendPublicUrl(req: Request): string {
    const env = process.env.EKATRAA_PUBLIC_API_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
    if (env) return env.replace(/\/$/, '')
    const url = new URL(req.url)
    return `${url.protocol}//${url.host}`
}

export async function OPTIONS(req: Request) {
    return new NextResponse(null, { status: 204, headers: planningCorsHeaders(req) })
}

/**
 * Returns Pipecat WebRTC connection config for live voice sessions.
 * Clients call Pipecat `/start` (or `/client`) with returned `request_data`.
 */
export async function POST(req: Request) {
    const cors = planningCorsHeaders(req)
    let body: unknown = {}
    try {
        body = await req.json()
    } catch {
        body = {}
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400, headers: cors })
    }

    const agent = parsed.data.agent || 'customer'
    const pipecatBase = resolvePipecatBaseUrl()
    const backendBase = resolveBackendPublicUrl(req)
    const threadId = parsed.data.thread_id?.trim() || `${agent}-voice-${Date.now()}`
    const voiceLang = parsed.data.voice_target_language_code?.trim() || 'en-IN'
    const transport = (process.env.PIPECAT_TRANSPORT?.trim().toLowerCase() || 'daily') as 'daily' | 'webrtc'

    const mastraOpenAiPath =
        agent === 'vendor'
            ? '/api/vendor/ai/voice/chat/completions'
            : '/api/public/ai/voice/chat/completions'

    const openAiBase = `${backendBase}${mastraOpenAiPath.replace(/\/chat\/completions$/, '')}`

    return NextResponse.json(
        {
            provider: 'pipecat',
            transport,
            pipecat: {
                start_url: `${pipecatBase}/start`,
                client_url: transport === 'daily' ? `${pipecatBase}/` : `${pipecatBase}/client`,
            },
            daily:
                transport === 'daily'
                    ? {
                          createDailyRoom: true,
                          dailyRoomProperties: { start_video_off: true },
                      }
                    : undefined,
            session: {
                agent,
                thread_id: threadId,
                voice_target_language_code: voiceLang,
            },
            mastra: {
                openai_base_url: openAiBase,
                openai_completions_url: `${backendBase}${mastraOpenAiPath}`,
            },
            /** Legacy chunked voice path remains available as fallback. */
            legacy_voice: {
                stt: '/api/public/ai/planning/stt',
                message: agent === 'vendor' ? '/api/vendor/ai/planning/message' : '/api/public/ai/planning/message',
                tts: '/api/public/ai/planning/tts',
            },
        },
        { headers: cors }
    )
}

export async function GET(req: Request) {
    return POST(req)
}
