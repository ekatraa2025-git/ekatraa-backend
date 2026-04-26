import { NextResponse } from 'next/server'
import { mastra } from '@/mastra'
import { getAiAppCatalogContext } from '@/lib/ai-app-context'
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
        const { message, history, city, occasion_id, occasion_name, planned_budget_inr } = parsed.data

        const threadId =
            req.headers.get('x-thread-id')?.trim() ||
            (typeof json.thread_id === 'string' && json.thread_id) ||
            'anonymous-mobile'

        const catalog = await getAiAppCatalogContext({
            city: city?.trim() || null,
            occasion_id: occasion_id?.trim() || null,
        })
        const budgetHint =
            typeof planned_budget_inr === 'number' &&
            planned_budget_inr > 0 &&
            Number.isFinite(planned_budget_inr)
                ? `\nUser context: planned total budget about ₹${Math.round(planned_budget_inr).toLocaleString('en-IN')}.`
                : ''
        const occasionHint = occasion_name?.trim()
            ? `\nUser is focused on "${occasion_name.trim()}" in the app.`
            : ''

        const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
            {
                role: 'system',
                content: `Catalog and app context:\n${catalog}${occasionHint}${budgetHint}`,
            },
        ]
        for (const h of history ?? []) {
            messages.push({ role: h.role, content: h.text.slice(0, 8000) })
        }
        messages.push({ role: 'user', content: message })

        const agent = mastra.getAgentById('event-planning-agent')
        const out = await agent.generate(messages, {
            memory: {
                thread: threadId,
                resource: 'ekatraa-mobile',
            },
        })

        const reply = out.text?.trim() || 'No reply from planner.'
        return NextResponse.json({ reply })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Planner failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
