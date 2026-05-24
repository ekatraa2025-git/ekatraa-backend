import { NextResponse } from 'next/server'
import { z } from 'zod'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'
import {
    buildMastraVoiceRequestContext,
    defaultVoiceResource,
    openAiVoiceJsonResponse,
    openAiVoiceStreamResponse,
    runMastraVoiceTurn,
    type OpenAiChatMessage,
    type VoiceSessionContext,
} from '@/lib/mastra-voice-openai'
import { getVendorFromRequest } from '@/lib/vendor-auth'

const bodySchema = z.object({
    model: z.string().optional(),
    messages: z
        .array(
            z.object({
                role: z.enum(['system', 'user', 'assistant', 'developer']),
                content: z.union([z.string(), z.array(z.unknown())]),
            })
        )
        .min(1),
    stream: z.boolean().optional(),
    session: z
        .object({
            thread_id: z.string().optional(),
            voice_target_language_code: z.string().optional(),
        })
        .optional(),
})

function normalizeMessages(raw: z.infer<typeof bodySchema>['messages']): OpenAiChatMessage[] {
    const out: OpenAiChatMessage[] = []
    for (const row of raw) {
        const content =
            typeof row.content === 'string'
                ? row.content
                : Array.isArray(row.content)
                  ? row.content
                        .map((part) => {
                            if (typeof part === 'string') return part
                            if (part && typeof part === 'object' && 'text' in part) {
                                const t = (part as { text?: unknown }).text
                                return typeof t === 'string' ? t : ''
                            }
                            return ''
                        })
                        .join('')
                  : ''
        if (!content.trim()) continue
        out.push({ role: row.role, content: content.trim() })
    }
    return out
}

function withCors(req: Request, response: NextResponse): NextResponse {
    const headers = new Headers(response.headers)
    for (const [key, value] of Object.entries(planningCorsHeaders(req))) {
        headers.set(key, value)
    }
    return new NextResponse(response.body, { status: response.status, headers })
}

/**
 * OpenAI-compatible chat completions for vendor Pipecat voice sessions.
 */
export async function OPTIONS(req: Request) {
    return new NextResponse(null, { status: 204, headers: planningCorsHeaders(req) })
}

export async function POST(req: Request) {
    const cors = planningCorsHeaders(req)
    const auth = await getVendorFromRequest(req)
    if (auth.error) return withCors(req, auth.error)

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: cors })
    }

    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400, headers: cors })
    }

    const messages = normalizeMessages(parsed.data.messages)
    if (!messages.length) {
        return NextResponse.json(
            { error: 'messages must include at least one non-empty entry' },
            { status: 400, headers: cors }
        )
    }

    const threadId =
        parsed.data.session?.thread_id?.trim() ||
        req.headers.get('x-thread-id')?.trim() ||
        `vendor-pipecat-${auth.vendorId}`

    const session: VoiceSessionContext = {
        agent: 'vendor',
        threadId,
        resource: defaultVoiceResource('vendor'),
        vendorId: auth.vendorId!,
        voice_target_language_code: parsed.data.session?.voice_target_language_code?.trim() || 'en-IN',
    }

    const requestContext = buildMastraVoiceRequestContext(session, auth.requesterUserId)

    try {
        const speechText = await runMastraVoiceTurn({
            messages,
            session,
            requestContext,
        })
        const response = parsed.data.stream
            ? openAiVoiceStreamResponse(speechText)
            : openAiVoiceJsonResponse(speechText)
        const headers = new Headers(response.headers)
        for (const [k, v] of Object.entries(cors)) {
            headers.set(k, v)
        }
        return new Response(response.body, { status: response.status, headers })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Vendor voice completion failed'
        return NextResponse.json({ error: msg }, { status: 500, headers: cors })
    }
}
