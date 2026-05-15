import { handleChatStream, type ChatStreamHandlerParams } from '@mastra/ai-sdk'
import { toAISdkMessages, toAISdkV5Messages } from '@mastra/ai-sdk/ui'
import { createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'
import { RequestContext } from '@mastra/core/request-context'
import { mastra } from '@/mastra'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { buildMastraAgentModelFallbacks } from '@/lib/mastra-llm-model'
import { getVendorFromRequest } from '@/lib/vendor-auth'

const DEFAULT_RESOURCE = 'ekatraa-vendor-assistant'

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 })
}

export async function POST(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const rc = new RequestContext()
    rc.set('vendorId', auth.vendorId!)

    try {
        const params = await req.json()
        const threadId =
            req.headers.get('x-thread-id')?.trim() ||
            (typeof params.memory?.thread === 'string' && params.memory.thread) ||
            `vendor-${auth.vendorId}`

        const runtime = await getAiRuntimeSettings()
        const modelChain = buildMastraAgentModelFallbacks(runtime)

        const stream = await handleChatStream({
            mastra,
            agentId: 'vendor-assistant-agent',
            version: 'v6',
            params: {
                ...params,
                model: modelChain,
                requestContext: rc,
                memory: {
                    ...params.memory,
                    thread: threadId,
                    resource: DEFAULT_RESOURCE,
                },
            } as unknown as ChatStreamHandlerParams,
        })
        return createUIMessageStreamResponse({
            stream: stream as Parameters<typeof createUIMessageStreamResponse>[0]['stream'],
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Vendor chat failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

export async function GET(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const threadId =
        req.headers.get('x-thread-id')?.trim() || `vendor-${auth.vendorId}`

    const memory = await mastra.getAgentById('vendor-assistant-agent').getMemory()
    let response = null
    try {
        response = await memory?.recall({
            threadId,
            resourceId: DEFAULT_RESOURCE,
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
    return NextResponse.json(uiMessages)
}
