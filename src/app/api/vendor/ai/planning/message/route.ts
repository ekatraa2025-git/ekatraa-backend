import { NextResponse } from 'next/server'
import { RequestContext } from '@mastra/core/request-context'
import { mastra } from '@/mastra'
import { getVendorFromRequest } from '@/lib/vendor-auth'
import { z } from 'zod'

const bodySchema = z.object({
    message: z.string().min(1).max(4000),
    history: z
        .array(
            z.object({
                role: z.enum(['user', 'assistant']),
                text: z.string(),
            })
        )
        .max(24)
        .optional(),
})

/**
 * Non-streaming vendor Mastra assistant (JSON { reply }).
 */
export async function POST(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    try {
        const json = await req.json()
        const parsed = bodySchema.safeParse(json)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
        }
        const { message, history } = parsed.data

        const rc = new RequestContext()
        rc.set('vendorId', auth.vendorId!)

        const threadId =
            req.headers.get('x-thread-id')?.trim() ||
            (typeof json.thread_id === 'string' && json.thread_id) ||
            `vendor-${auth.vendorId}`

        const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
            {
                role: 'system',
                content: `You are assisting vendor_id=${auth.vendorId}. Use list_my_orders for grounded data.`,
            },
        ]
        for (const h of history ?? []) {
            messages.push({ role: h.role, content: h.text.slice(0, 8000) })
        }
        messages.push({ role: 'user', content: message })

        const agent = mastra.getAgentById('vendor-assistant-agent')
        const out = await agent.generate(messages, {
            requestContext: rc,
            memory: {
                thread: threadId,
                resource: 'ekatraa-vendor-assistant',
            },
        })

        return NextResponse.json({ reply: out.text?.trim() || 'No reply.' })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Vendor assistant failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
