import { NextResponse } from 'next/server'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import {
    anthropicErrorToHttp,
    extractAnthropicText,
    getAnthropicClient,
    getClaudeModel,
    withTimeout,
} from '@/lib/claude-client'

const CHAT_SYSTEM = `You are Ekatraa AI, a friendly assistant for people in India using the Ekatraa app to plan weddings, birthdays, funerals, and other gatherings.

Guidelines:
- Keep replies concise (a few short paragraphs at most unless the user asks for detail).
- Be warm and practical. Mention that real vendors, prices, and availability are in the Ekatraa app.
- Do not invent specific venue or vendor names, exact prices, or guarantees.
- If the user needs bookings or listings, suggest they browse services in the app for their city.

You are not a lawyer or doctor; do not give legal or medical advice.`

type HistoryItem = { role: string; text: string }

function clampHistory(history: unknown, maxItems: number): HistoryItem[] {
    if (!Array.isArray(history)) return []
    const out: HistoryItem[] = []
    for (const row of history) {
        if (!row || typeof row !== 'object') continue
        const r = row as Record<string, unknown>
        const role = r.role === 'user' || r.role === 'assistant' ? r.role : null
        const text = typeof r.text === 'string' ? r.text : ''
        if (!role || !text.trim()) continue
        out.push({ role, text: text.slice(0, 8000) })
    }
    return out.slice(-maxItems)
}

/**
 * POST /api/public/ai/chat
 * Body: { message: string, history?: { role: 'user' | 'assistant', text: string }[] }
 * Requires CLAUDE_API_KEY or ANTHROPIC_API_KEY.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const message = typeof body.message === 'string' ? body.message.trim() : ''
        if (!message) {
            return NextResponse.json({ error: 'message is required' }, { status: 400 })
        }
        if (message.length > 4000) {
            return NextResponse.json({ error: 'message is too long' }, { status: 400 })
        }

        const history = clampHistory(body.history, 24)
        const client = getAnthropicClient()
        const model = getClaudeModel()

        const messages: MessageParam[] = []
        for (const h of history) {
            messages.push({
                role: h.role as 'user' | 'assistant',
                content: h.text,
            })
        }
        messages.push({ role: 'user', content: message })

        const raw = await withTimeout(
            client.messages.create({
                model,
                max_tokens: 4096,
                temperature: 0.6,
                system: CHAT_SYSTEM,
                messages,
            }),
            45_000,
            'Chat'
        )

        const reply = extractAnthropicText(raw).trim()
        if (!reply) {
            return NextResponse.json({ error: 'AI returned an empty reply' }, { status: 502 })
        }

        return NextResponse.json({
            reply: reply.slice(0, 12_000),
            ai_meta: { model, source: 'claude' },
        })
    } catch (e) {
        const { status, body } = anthropicErrorToHttp(e)
        return NextResponse.json(body, { status })
    }
}
