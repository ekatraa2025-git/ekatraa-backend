import { NextResponse } from 'next/server'
import { RequestContext } from '@mastra/core/request-context'
import { mastra } from '@/mastra'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { mastraAgentModelForInvocation } from '@/lib/mastra-llm-model'
import { getVendorFromRequest } from '@/lib/vendor-auth'
import { toSpeechSafeText } from '@/lib/voice-text'
import { buildVoiceReplyLanguageHint } from '@/lib/voice-languages'
import {
    buildUsefulInfoExtracted,
    inferDetectedLanguage,
    logVendorAiConversationTurn,
} from '@/lib/vendor-ai-conversation-log'
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
    response_mode: z.enum(['text', 'voice']).optional(),
    voice_target_language_code: z.string().trim().min(2).max(16).optional(),
    channel: z.enum(['app', 'whatsapp']).optional(),
    language: z.enum(['en', 'hi', 'bn', 'or']).optional(),
    thread_id: z.string().optional(),
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
        const { message, history, response_mode, voice_target_language_code, channel, language } = parsed.data

        const rc = new RequestContext()
        rc.set('vendorId', auth.vendorId!)

        const threadId =
            req.headers.get('x-thread-id')?.trim() ||
            parsed.data.thread_id?.trim() ||
            `vendor-${auth.vendorId}`

        const resolvedChannel = channel ?? 'app'

        const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
            {
                role: 'system',
                content: `You are Ekaa assisting vendor_id=${auth.vendorId} on channel=${resolvedChannel}.${
                    language ? ` Preferred language code: ${language}.` : ''
                } Use list_my_orders for grounded order data. Delegate to sub-agents when the topic fits a specialist area.${
                    response_mode === 'voice' ? buildVoiceReplyLanguageHint(voice_target_language_code) : ''
                }`,
            },
        ]
        for (const h of history ?? []) {
            messages.push({ role: h.role, content: h.text.slice(0, 8000) })
        }
        messages.push({ role: 'user', content: message })

        const agent = mastra.getAgentById('vendor-assistant-agent')
        const runtime = await getAiRuntimeSettings()
        const out = await agent.generate(messages, {
            model: mastraAgentModelForInvocation(runtime),
            requestContext: rc,
            memory: {
                thread: threadId,
                resource: 'ekatraa-vendor-assistant',
            },
        })

        const reply = out.text?.trim() || 'No reply.'
        const speechText = response_mode === 'voice' ? toSpeechSafeText(reply, 1200) : null

        void logVendorAiConversationTurn({
            vendorId: auth.vendorId!,
            threadId,
            channel: resolvedChannel,
            language,
            userMessage: message,
            assistantReply: reply,
            agentOutput: out,
        })

        const detectedLanguage = inferDetectedLanguage(message, language)
        const usefulInfo = buildUsefulInfoExtracted(message, reply)

        return NextResponse.json({
            reply,
            conversation: {
                thread_id: threadId,
                channel: resolvedChannel,
                language: language ?? detectedLanguage,
                useful_info_extracted: usefulInfo,
            },
            ...(speechText
                ? {
                      speech_text: speechText,
                      voice: {
                          tts_endpoint: '/api/public/ai/planning/tts',
                          target_language_code: voice_target_language_code || 'en-IN',
                      },
                  }
                : {}),
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Vendor assistant failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
