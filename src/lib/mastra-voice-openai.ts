import { RequestContext } from '@mastra/core/request-context'
import { mastra } from '@/mastra'
import { getAiAppCatalogContext } from '@/lib/ai-app-context'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { mastraAgentModelForInvocation } from '@/lib/mastra-llm-model'
import { toSpeechSafeText } from '@/lib/voice-text'
import { buildVoiceReplyLanguageHint } from '@/lib/voice-languages'

export type OpenAiChatMessage = {
    role: 'system' | 'user' | 'assistant' | 'developer'
    content: string
}

export type VoiceAgentKind = 'customer' | 'vendor'

export type VoiceSessionContext = {
    agent: VoiceAgentKind
    threadId: string
    resource: string
    city?: string
    occasion_id?: string
    occasion_name?: string
    planned_budget_inr?: number
    event_form_snapshot?: Record<string, unknown>
    cart_owner_session_id?: string
    voice_target_language_code?: string
    vendorId?: string
}

function clampHistory(messages: OpenAiChatMessage[], maxItems: number): OpenAiChatMessage[] {
    const usable = messages.filter(
        (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()
    )
    return usable.slice(-maxItems)
}

function extractDeveloperInstructions(messages: OpenAiChatMessage[]): string {
    return messages
        .filter(
            (m) =>
                (m.role === 'developer' || m.role === 'system') &&
                typeof m.content === 'string' &&
                m.content.trim()
        )
        .map((m) => m.content.trim())
        .join('\n')
}

/** Pipecat may call the LLM on connect with developer-only context (no STT user turn yet). */
function resolveVoiceUserTurn(messages: OpenAiChatMessage[]): {
    message: string
    developerHint: string
    prior: OpenAiChatMessage[]
} {
    const history = clampHistory(messages, 24)
    const lastUserIdx = history.map((m) => m.role).lastIndexOf('user')
    const developerHint = extractDeveloperInstructions(messages)

    if (lastUserIdx >= 0) {
        return {
            message: history[lastUserIdx].content.trim(),
            developerHint,
            prior: history.filter((_, i) => i !== lastUserIdx),
        }
    }

    return {
        message: 'I just connected to live voice chat.',
        developerHint,
        prior: history,
    }
}

function encodeOpenAiSseChunk(content: string, id: string): string {
    const payload = {
        id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'ekatraa-mastra-voice',
        choices: [{ index: 0, delta: { content }, finish_reason: null }],
    }
    return `data: ${JSON.stringify(payload)}\n\n`
}

function encodeOpenAiSseDone(id: string): string {
    const payload = {
        id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'ekatraa-mastra-voice',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    }
    return `data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`
}

export function openAiVoiceStreamResponse(text: string): Response {
    const id = `chatcmpl-${Date.now()}`
    const body = encodeOpenAiSseChunk(text, id) + encodeOpenAiSseDone(id)
    return new Response(body, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    })
}

export function openAiVoiceJsonResponse(text: string): Response {
    const id = `chatcmpl-${Date.now()}`
    return Response.json({
        id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'ekatraa-mastra-voice',
        choices: [
            {
                index: 0,
                message: { role: 'assistant', content: text },
                finish_reason: 'stop',
            },
        ],
    })
}

export async function runMastraVoiceTurn(args: {
    messages: OpenAiChatMessage[]
    session: VoiceSessionContext
    requestContext: RequestContext
    bearerToken?: string | null
}): Promise<string> {
    const { messages, session, requestContext } = args
    const { message, developerHint, prior: priorMessages } = resolveVoiceUserTurn(messages)

    const prior = priorMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        text: m.content.slice(0, 8000),
    }))

    const voiceHint = buildVoiceReplyLanguageHint(session.voice_target_language_code)

    let systemContent = voiceHint
    if (session.agent === 'customer') {
        const catalog = await getAiAppCatalogContext({
            city: session.city?.trim() || null,
            occasion_id: session.occasion_id?.trim() || null,
        })
        const budgetHint =
            typeof session.planned_budget_inr === 'number' && Number.isFinite(session.planned_budget_inr)
                ? `\nUser context: planned total budget about ₹${Math.round(session.planned_budget_inr).toLocaleString('en-IN')}.`
                : ''
        const occasionHint = session.occasion_name?.trim()
            ? `\nUser is focused on "${session.occasion_name.trim()}" in the app.`
            : ''
        let eventDetailsHint = ''
        if (session.event_form_snapshot && Object.keys(session.event_form_snapshot).length > 0) {
            try {
                eventDetailsHint = `\nUser event details (from app form): ${JSON.stringify(session.event_form_snapshot).slice(0, 3500)}`
            } catch {
                eventDetailsHint = ''
            }
        }
        systemContent = `Catalog and app context:\n${catalog}${occasionHint}${budgetHint}${eventDetailsHint}${voiceHint}`
    } else if (session.vendorId) {
        systemContent = `You are assisting vendor_id=${session.vendorId}. Use list_my_orders for grounded data.${voiceHint}`
    }

    if (developerHint) {
        systemContent += `\nDeveloper instruction: ${developerHint}`
    }

    const agentMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
        { role: 'system', content: systemContent },
    ]
    for (const h of prior) {
        agentMessages.push({ role: h.role, content: h.text })
    }
    agentMessages.push({ role: 'user', content: message })

    const agentId = session.agent === 'vendor' ? 'vendor-assistant-agent' : 'event-planning-agent'
    const agent = mastra.getAgentById(agentId)
    const runtime = await getAiRuntimeSettings()
    const out = await agent.generate(agentMessages, {
        model: mastraAgentModelForInvocation(runtime),
        requestContext,
        memory: {
            thread: session.threadId,
            resource: session.resource,
        },
    })

    const reply = out.text?.trim() || 'No reply from planner.'
    return toSpeechSafeText(reply, 1200)
}

export function parseVoiceSessionFromHeaders(req: Request): Partial<VoiceSessionContext> {
    const h = req.headers
    return {
        threadId: h.get('x-thread-id')?.trim() || undefined,
        city: h.get('x-voice-city')?.trim() || undefined,
        occasion_id: h.get('x-voice-occasion-id')?.trim() || undefined,
        occasion_name: h.get('x-voice-occasion-name')?.trim() || undefined,
        cart_owner_session_id: h.get('x-voice-cart-session')?.trim() || undefined,
        voice_target_language_code: h.get('x-voice-lang')?.trim() || undefined,
    }
}

export function buildMastraVoiceRequestContext(session: VoiceSessionContext, userId?: string | null): RequestContext {
    const rc = new RequestContext()
    if (userId) rc.set('authenticatedUserId', userId)
    if (session.cart_owner_session_id) rc.set('trustedCartSessionId', session.cart_owner_session_id)
    if (session.vendorId) rc.set('vendorId', session.vendorId)
    return rc
}

export function defaultVoiceResource(agent: VoiceAgentKind): string {
    return agent === 'vendor' ? 'ekatraa-vendor-assistant' : 'ekatraa-pipecat-voice'
}
