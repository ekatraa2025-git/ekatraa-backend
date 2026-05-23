import { NextResponse } from 'next/server'
import { z } from 'zod'
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

/**
 * OpenAI-compatible chat completions for vendor Pipecat voice sessions.
 */
export async function POST(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 })
    }

    const messages = normalizeMessages(parsed.data.messages)
    if (!messages.length) {
        return NextResponse.json({ error: 'messages must include at least one non-empty entry' }, { status: 400 })
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

    const requestContext = buildMastraVoiceRequestContext(session)

    try {
        const speechText = await runMastraVoiceTurn({
            messages,
            session,
            requestContext,
        })
        return parsed.data.stream ? openAiVoiceStreamResponse(speechText) : openAiVoiceJsonResponse(speechText)
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Vendor voice completion failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
