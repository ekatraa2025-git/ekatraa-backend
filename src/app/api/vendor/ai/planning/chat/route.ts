import { handleChatStream } from '@mastra/ai-sdk'
import { toAISdkV5Messages } from '@mastra/ai-sdk/ui'
import { createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'
import { RequestContext } from '@mastra/core/request-context'
import { mastra } from '@/mastra'
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

        const stream = await handleChatStream({
            mastra,
            agentId: 'vendor-assistant-agent',
            version: 'v6',
            params: {
                ...params,
                requestContext: rc,
                memory: {
                    ...params.memory,
                    thread: threadId,
                    resource: DEFAULT_RESOURCE,
                },
            },
        })
        return createUIMessageStreamResponse({ stream })
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

    const uiMessages = toAISdkV5Messages(response?.messages || [])
    return NextResponse.json(uiMessages)
}
