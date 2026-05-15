import { NextResponse } from 'next/server'
import { RequestContext } from '@mastra/core/request-context'
import { mastra } from '@/mastra'
import { getAiAppCatalogContext } from '@/lib/ai-app-context'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
<<<<<<< HEAD
import { chatWithOpenRouter } from '@/lib/openrouter-client'
import {
    anthropicErrorToHttp,
    extractAnthropicText,
    getAnthropicClient,
    sanitizeAssistantReplyText,
    withTimeout,
} from '@/lib/claude-client'
import { resolveOptionalBearerUser } from '@/lib/user-auth'
=======
import { buildMastraAgentModelFallbacks, mastraAgentModelForInvocation } from '@/lib/mastra-llm-model'
import { resolveOptionalBearerUser } from '@/lib/user-auth'
import { toSpeechSafeText } from '@/lib/voice-text'
>>>>>>> 6ce4ae0 (Vendor Deletion fixes)
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
    city: z.string().optional(),
    // Mobile app may send numeric occasion ids from JS state — coerce to string.
    occasion_id: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
    occasion_name: z.string().optional(),
    planned_budget_inr: z.number().optional(),
    /** Rich snapshot from the app user-info wizard (contact, location, guests, budget label, etc.) */
    event_form_snapshot: z.record(z.string(), z.unknown()).optional(),
    /**
     * For anonymous carts: must match `carts.session_id` so Mastra `get_cart_summary` can authorize reads.
     * Omit for JWT-only flows when the cart row is user-bound (Bearer required for those reads).
     */
    cart_owner_session_id: z.string().max(512).optional(),
<<<<<<< HEAD
=======
    response_mode: z.enum(['text', 'voice']).optional(),
    voice_target_language_code: z.string().trim().min(2).max(16).optional(),
>>>>>>> 6ce4ae0 (Vendor Deletion fixes)
})

/**
 * Non-streaming Mastra agent turn for mobile clients (JSON { reply }).
 * Prefer POST /api/public/ai/planning/chat for web streaming (AI SDK UI).
 */
export async function POST(req: Request) {
    try {
        const json = await req.json()
        const parsed = bodySchema.safeParse(json)
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 })
        }
<<<<<<< HEAD
        const { message, history, city, occasion_id, occasion_name, planned_budget_inr, event_form_snapshot, cart_owner_session_id } =
=======
        const {
            message,
            history,
            city,
            occasion_id,
            occasion_name,
            planned_budget_inr,
            event_form_snapshot,
            cart_owner_session_id,
            response_mode,
            voice_target_language_code,
        } =
>>>>>>> 6ce4ae0 (Vendor Deletion fixes)
            parsed.data

        const auth = await resolveOptionalBearerUser(req)
        if (auth.error) return auth.error

        const threadId =
            req.headers.get('x-thread-id')?.trim() ||
            (typeof json.thread_id === 'string' && json.thread_id) ||
            'anonymous-mobile'

        const plannerRequestContext = new RequestContext()
        if (auth.userId) {
            plannerRequestContext.set('authenticatedUserId', auth.userId)
        }
        const sessionClaim = typeof cart_owner_session_id === 'string' ? cart_owner_session_id.trim() : ''
        if (sessionClaim) {
            plannerRequestContext.set('trustedCartSessionId', sessionClaim)
        }

        const plannerRequestContext = new RequestContext()
        if (auth.userId) {
            plannerRequestContext.set('authenticatedUserId', auth.userId)
        }
        const sessionClaim = typeof cart_owner_session_id === 'string' ? cart_owner_session_id.trim() : ''
        if (sessionClaim) {
            plannerRequestContext.set('trustedCartSessionId', sessionClaim)
        }

        const catalog = await getAiAppCatalogContext({
            city: city?.trim() || null,
            occasion_id: occasion_id?.trim() || null,
        })
        const budgetHint =
            typeof planned_budget_inr === 'number' && Number.isFinite(planned_budget_inr)
                ? `\nUser context: planned total budget about ₹${Math.round(planned_budget_inr).toLocaleString('en-IN')}${planned_budget_inr === 0 ? ' (flexible / to be decided)' : ''}.`
                : ''
        const occasionHint = occasion_name?.trim()
            ? `\nUser is focused on "${occasion_name.trim()}" in the app.`
            : ''
        let eventDetailsHint = ''
        if (event_form_snapshot && typeof event_form_snapshot === 'object' && Object.keys(event_form_snapshot).length > 0) {
            try {
                eventDetailsHint = `\nUser event details (from app form): ${JSON.stringify(event_form_snapshot).slice(0, 3500)}`
            } catch {
                eventDetailsHint = ''
            }
        }
        const isVoiceMode = response_mode === 'voice'
        const voiceHint = isVoiceMode
            ? `\nVoice mode is active. Keep replies concise, natural, and easy to speak aloud. Avoid markdown tables and links. Prefer short sentences and plain language. Target language: ${voice_target_language_code || 'en-IN'}.`
            : ''

        const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
            {
                role: 'system',
                content: `Catalog and app context:\n${catalog}${occasionHint}${budgetHint}${eventDetailsHint}${voiceHint}`,
            },
        ]
        for (const h of history ?? []) {
            messages.push({ role: h.role, content: h.text.slice(0, 8000) })
        }
        messages.push({ role: 'user', content: message })

        const agent = mastra.getAgentById('event-planning-agent')
        const runtime = await getAiRuntimeSettings()
        const modelFallbacks = buildMastraAgentModelFallbacks(runtime)
        const out = await agent.generate(messages, {
<<<<<<< HEAD
=======
            model: mastraAgentModelForInvocation(runtime),
>>>>>>> 6ce4ae0 (Vendor Deletion fixes)
            requestContext: plannerRequestContext,
            memory: {
                thread: threadId,
                resource: 'ekatraa-mobile',
            },
        })

        const reply = out.text?.trim() || 'No reply from planner.'
        const speechText = isVoiceMode ? toSpeechSafeText(reply, 1200) : null
        return NextResponse.json({
            reply,
            ...(speechText
                ? {
                      speech_text: speechText,
                      voice: {
                          tts_endpoint: '/api/public/ai/planning/tts',
                          target_language_code: voice_target_language_code || 'en-IN',
                      },
                  }
                : {}),
            ai_meta: {
                source: 'mastra',
                routing: `${runtime.provider}_primary_with_fallbacks`,
                models: modelFallbacks.map((x) => x.model),
            },
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Planner failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
