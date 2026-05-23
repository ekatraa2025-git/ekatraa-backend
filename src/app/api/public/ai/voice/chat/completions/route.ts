import { NextResponse } from 'next/server'
import { z } from 'zod'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'
import {
    buildMastraVoiceRequestContext,
    defaultVoiceResource,
    openAiVoiceJsonResponse,
    openAiVoiceStreamResponse,
    parseVoiceSessionFromHeaders,
    runMastraVoiceTurn,
    type OpenAiChatMessage,
    type VoiceSessionContext,
} from '@/lib/mastra-voice-openai'
import { resolveVoiceUserId } from '@/lib/user-auth'

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
    /** Pipecat / client session metadata (also accepted via X-* headers). */
    session: z
        .object({
            thread_id: z.string().optional(),
            city: z.string().optional(),
            occasion_id: z.union([z.string(), z.number()]).optional(),
            occasion_name: z.string().optional(),
            planned_budget_inr: z.number().optional(),
            event_form_snapshot: z.record(z.string(), z.unknown()).optional(),
            cart_owner_session_id: z.string().optional(),
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

function buildSession(
    req: Request,
    jsonSession: z.infer<typeof bodySchema>['session']
): VoiceSessionContext {
    const fromHeaders = parseVoiceSessionFromHeaders(req)
    const threadId =
        jsonSession?.thread_id?.trim() ||
        fromHeaders.threadId ||
        req.headers.get('x-thread-id')?.trim() ||
        `pipecat-customer-${Date.now()}`
    const occasionIdRaw = jsonSession?.occasion_id
    return {
        agent: 'customer',
        threadId,
        resource: defaultVoiceResource('customer'),
        city: jsonSession?.city?.trim() || fromHeaders.city,
        occasion_id: occasionIdRaw != null ? String(occasionIdRaw) : fromHeaders.occasion_id,
        occasion_name: jsonSession?.occasion_name?.trim() || fromHeaders.occasion_name,
        planned_budget_inr: jsonSession?.planned_budget_inr,
        event_form_snapshot: jsonSession?.event_form_snapshot,
        cart_owner_session_id:
            jsonSession?.cart_owner_session_id?.trim() || fromHeaders.cart_owner_session_id,
        voice_target_language_code:
            jsonSession?.voice_target_language_code?.trim() ||
            fromHeaders.voice_target_language_code ||
            'en-IN',
    }
}

export async function OPTIONS(req: Request) {
    return new NextResponse(null, { status: 204, headers: planningCorsHeaders(req) })
}

/**
 * OpenAI-compatible chat completions for Pipecat voice pipelines.
 * Proxies turns to Mastra `event-planning-agent` with voice-safe output.
 */
export async function POST(req: Request) {
    const cors = planningCorsHeaders(req)
    const auth = await resolveVoiceUserId(req)
    if (auth.error) return auth.error

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
        return NextResponse.json({ error: 'messages must include at least one non-empty entry' }, { status: 400, headers: cors })
    }

    const session = buildSession(req, parsed.data.session)
    const requestContext = buildMastraVoiceRequestContext(session, auth.userId)

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
        const msg = e instanceof Error ? e.message : 'Voice completion failed'
        return NextResponse.json({ error: msg }, { status: 500, headers: cors })
    }
}
