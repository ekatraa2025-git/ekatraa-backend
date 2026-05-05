import { NextResponse } from 'next/server'
import { mastra } from '@/mastra'
import { getAiAppCatalogContext } from '@/lib/ai-app-context'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { chatWithOpenRouter } from '@/lib/openrouter-client'
import {
    anthropicErrorToHttp,
    extractAnthropicText,
    getAnthropicClient,
    sanitizeAssistantReplyText,
    withTimeout,
} from '@/lib/claude-client'
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
        const { message, history, city, occasion_id, occasion_name, planned_budget_inr, event_form_snapshot } =
            parsed.data

        const threadId =
            req.headers.get('x-thread-id')?.trim() ||
            (typeof json.thread_id === 'string' && json.thread_id) ||
            'anonymous-mobile'
        const sessionId =
            (typeof json.session_id === 'string' && json.session_id.trim()) ||
            threadId ||
            `planning-${Date.now()}`

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

        const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
            {
                role: 'system',
                content: `Catalog and app context:\n${catalog}${occasionHint}${budgetHint}${eventDetailsHint}`,
            },
        ]
        for (const h of history ?? []) {
            messages.push({ role: h.role, content: h.text.slice(0, 8000) })
        }
        messages.push({ role: 'user', content: message })

        const runtime = await getAiRuntimeSettings()

        if (runtime.provider === 'openrouter') {
            const system = messages.find((m) => m.role === 'system')?.content || ''
            const historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = messages.flatMap((m) =>
                m.role === 'user' || m.role === 'assistant'
                    ? [{ role: m.role, content: m.content }]
                    : []
            )
            const out = await chatWithOpenRouter({
                model: runtime.openrouterModel || runtime.primaryModel,
                system,
                messages: historyMessages,
                temperature: 0.6,
                maxTokens: 2048,
                sessionId,
            })
            return NextResponse.json({
                reply: out.text,
                ai_meta: { source: 'openrouter', provider: 'openrouter', model: out.model },
            })
        }

        if (runtime.provider === 'claude') {
            const system = messages.find((m) => m.role === 'system')?.content || ''
            const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = messages.flatMap((m) =>
                m.role === 'user' || m.role === 'assistant'
                    ? [{ role: m.role, content: m.content }]
                    : []
            )
            const raw = await withTimeout(
                getAnthropicClient().messages.create({
                    model: runtime.claudeModel || runtime.primaryModel,
                    max_tokens: 4096,
                    temperature: 0.6,
                    system,
                    messages: anthropicMessages,
                }),
                45_000,
                'Planning chat'
            )
            const reply = sanitizeAssistantReplyText(extractAnthropicText(raw))
            return NextResponse.json({
                reply: reply || 'No reply from planner.',
                ai_meta: { source: 'claude', provider: 'claude', model: runtime.claudeModel || runtime.primaryModel },
            })
        }

        const agent = mastra.getAgentById('event-planning-agent')
        const out = await agent.generate(messages, {
            memory: {
                thread: threadId,
                resource: 'ekatraa-mobile',
            },
        })

        const reply = out.text?.trim() || 'No reply from planner.'
        return NextResponse.json({
            reply,
            ai_meta: { source: 'mastra-gemini', provider: 'gemini', model: runtime.geminiModel || runtime.primaryModel },
        })
    } catch (e) {
        const m = e instanceof Error ? e.message : ''
        if (m.includes('ANTHROPIC') || m.includes('CLAUDE_API_KEY')) {
            const { status, body } = anthropicErrorToHttp(e)
            return NextResponse.json(body, { status })
        }
        const msg = e instanceof Error ? e.message : 'Planner failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
