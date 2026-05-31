import { handleChatStream, type ChatStreamHandlerParams } from '@mastra/ai-sdk'
import { toAISdkMessages, toAISdkV5Messages } from '@mastra/ai-sdk/ui'
import { RequestContext } from '@mastra/core/request-context'
import { createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'
import { mastra } from '@/mastra'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { buildMastraAgentModelFallbacks } from '@/lib/mastra-llm-model'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'
import { resolveOptionalBearerUser } from '@/lib/user-auth'
import { fetchUserOrderPlanningContext, formatPlanningOrderContextForPrompt } from '@/lib/planning-order-context'

const DEFAULT_CUSTOMER_RESOURCE = 'ekatraa-web-planning'

function withCors(req: Request, response: NextResponse): NextResponse {
    const headers = new Headers(response.headers)
    for (const [key, value] of Object.entries(planningCorsHeaders(req))) {
        headers.set(key, value)
    }
    return new NextResponse(response.body, { status: response.status, headers })
}

export async function OPTIONS(req: Request) {
    return new NextResponse(null, { status: 204, headers: planningCorsHeaders(req) })
}

/**
 * Streaming planning chat (AI SDK UI v6) — mirrors vendor route but optional Bearer + cart session hints.
 */
export async function POST(req: Request) {
    const cors = planningCorsHeaders(req)
    const auth = await resolveOptionalBearerUser(req)
    if (auth.error) return withCors(req, auth.error)

    try {
        const params = (await req.json()) as Record<string, unknown>

        let cartSessionClaim = ''
        if (typeof params.cart_owner_session_id === 'string') {
            cartSessionClaim = params.cart_owner_session_id.trim().slice(0, 512)
        }

        const rc = new RequestContext()
        if (auth.userId) {
            rc.set('authenticatedUserId', auth.userId)
        }
        if (cartSessionClaim) {
            rc.set('trustedCartSessionId', cartSessionClaim)
        }

        const threadId =
            req.headers.get('x-thread-id')?.trim() ||
            (typeof (params.memory as { thread?: unknown } | undefined)?.thread === 'string' &&
                (params.memory as { thread: string }).thread) ||
            'anonymous-web'

        const incomingMemory =
            params.memory != null && typeof params.memory === 'object' ? (params.memory as Record<string, unknown>) : {}

        const runtime = await getAiRuntimeSettings()
        const modelChain = buildMastraAgentModelFallbacks(runtime)

        let chatParams = { ...params }
        if (auth.userId) {
            const orderContextHint = formatPlanningOrderContextForPrompt(await fetchUserOrderPlanningContext(auth.userId))
            if (orderContextHint) {
                const rawMessages = Array.isArray(chatParams.messages) ? [...chatParams.messages] : []
                const sysIdx = rawMessages.findIndex(
                    (m) => m && typeof m === 'object' && (m as { role?: string }).role === 'system'
                )
                if (sysIdx >= 0) {
                    const existing = rawMessages[sysIdx] as { role: string; content?: unknown }
                    rawMessages[sysIdx] = {
                        ...existing,
                        content: `${String(existing.content || '')}${orderContextHint}`,
                    }
                } else {
                    rawMessages.unshift({ role: 'system', content: `Planning context:${orderContextHint}` })
                }
                chatParams = { ...chatParams, messages: rawMessages }
            }
        }

        const stream = await handleChatStream({
            mastra,
            agentId: 'event-planning-agent',
            version: 'v6',
            sendReasoning: true,
            params: {
                ...chatParams,
                model: modelChain,
                requestContext: rc,
                memory: {
                    ...incomingMemory,
                    thread: threadId,
                    resource: DEFAULT_CUSTOMER_RESOURCE,
                },
            } as unknown as ChatStreamHandlerParams,
        })
        return createUIMessageStreamResponse({
            stream: stream as Parameters<typeof createUIMessageStreamResponse>[0]['stream'],
            headers: cors,
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Planning chat failed'
        return NextResponse.json({ error: msg }, { status: 500, headers: cors })
    }
}

export async function GET(req: Request) {
    const cors = planningCorsHeaders(req)
    const url = new URL(req.url)
    const threadId =
        req.headers.get('x-thread-id')?.trim() || url.searchParams.get('thread')?.trim() || 'anonymous-web'

    try {
        const memory = await mastra.getAgentById('event-planning-agent').getMemory()
        let response = null
        try {
            response = await memory?.recall({
                threadId,
                resourceId: DEFAULT_CUSTOMER_RESOURCE,
            })
        } catch {
            /* no history */
        }

        let uiMessages: unknown[]
        try {
            uiMessages = toAISdkMessages(response?.messages || [], { version: 'v6' })
        } catch {
            uiMessages = toAISdkV5Messages(response?.messages || [])
        }
        return NextResponse.json(uiMessages, { headers: cors })
    } catch {
        return NextResponse.json([], { headers: cors })
    }
}
