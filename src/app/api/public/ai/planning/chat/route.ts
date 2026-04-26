import { handleChatStream } from '@mastra/ai-sdk'
import { toAISdkV5Messages } from '@mastra/ai-sdk/ui'
import { createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'
import { mastra } from '@/mastra'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'

const DEFAULT_THREAD = 'anonymous-planning'
const DEFAULT_RESOURCE = 'ekatraa-web-chat'

export async function OPTIONS(req: Request) {
    return new NextResponse(null, {
        status: 204,
        headers: planningCorsHeaders(req),
    })
}

export async function POST(req: Request) {
    const cors = planningCorsHeaders(req)
    try {
        const params = await req.json()
        const threadHeader = req.headers.get('x-thread-id')?.trim()
        const threadId =
            threadHeader ||
            (typeof params.memory?.thread === 'string' && params.memory.thread) ||
            DEFAULT_THREAD
        const resourceId =
            (typeof params.memory?.resource === 'string' && params.memory.resource) || DEFAULT_RESOURCE

        const stream = await handleChatStream({
            mastra,
            agentId: 'event-planning-agent',
            version: 'v6',
            params: {
                ...params,
                memory: {
                    ...params.memory,
                    thread: threadId,
                    resource: resourceId,
                },
            },
        })
        return createUIMessageStreamResponse({
            stream,
            headers: cors,
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Chat failed'
        return NextResponse.json({ error: msg }, { status: 500, headers: cors })
    }
}

export async function GET(req: Request) {
    const cors = planningCorsHeaders(req)
    const threadHeader = req.headers.get('x-thread-id')?.trim() || DEFAULT_THREAD
    const resourceId = DEFAULT_RESOURCE

    const memory = await mastra.getAgentById('event-planning-agent').getMemory()
    let response = null
    try {
        response = await memory?.recall({
            threadId: threadHeader,
            resourceId,
        })
    } catch {
        /* no history */
    }

    const uiMessages = toAISdkV5Messages(response?.messages || [])
    return NextResponse.json(uiMessages, { headers: cors })
}
