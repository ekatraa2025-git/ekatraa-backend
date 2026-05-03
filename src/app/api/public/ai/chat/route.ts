import { NextResponse } from 'next/server'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import { getAiAppCatalogContext } from '@/lib/ai-app-context'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import {
    anthropicErrorToHttp,
    extractAnthropicText,
    getAnthropicClient,
    sanitizeAssistantReplyText,
    withTimeout,
} from '@/lib/claude-client'
import { chatWithOpenRouter } from '@/lib/openrouter-client'
import { generateTextWithGemini } from '@/lib/gemini-client'

const CHAT_SYSTEM_BASE = `You are Ekatraa AI, a friendly assistant for people in India using the Ekatraa app to plan weddings, birthdays, funerals, and other gatherings.

Guidelines:
- Keep replies concise (a few short paragraphs at most unless the user asks for detail).
- Be warm and practical. Ground suggestions in the Ekatraa catalog we append below: mention real occasion types, category areas, and service areas that appear there when it helps the user.
- Encourage browsing Services in the app for their city for live packages and prices. Do not invent specific venue or vendor brand names, exact prices, or guarantees.
- When suggesting "what to look at next", name 2–4 concrete areas from the catalog (occasions, categories, or service types) instead of generic filler.
- Answer directly about their event. Do not name your underlying model (e.g. "Claude Sonnet") or say you are an Anthropic product unless the user explicitly asks.

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
 * Body: { message: string, history?: { role: 'user' | 'assistant', text: string }[], city?: string, occasion_id?: string, occasion_name?: string, planned_budget_inr?: number }
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
        const runtime = await getAiRuntimeSettings()

        const city = typeof body.city === 'string' ? body.city.trim() : ''
        const occasion_id = typeof body.occasion_id === 'string' ? body.occasion_id.trim() : ''
        const occasion_name = typeof body.occasion_name === 'string' ? body.occasion_name.trim() : ''
        const session_id = typeof body.session_id === 'string' ? body.session_id.trim() : ''
        const planned_budget_inr = Number(body.planned_budget_inr)
        const budgetHint =
            Number.isFinite(planned_budget_inr) && planned_budget_inr > 0
                ? `\nUser context from the app: planned total budget about ₹${Math.round(planned_budget_inr).toLocaleString('en-IN')} (rough planning figure).`
                : ''

        const catalog = await getAiAppCatalogContext({ city: city || null, occasion_id: occasion_id || null })
        const occasionHint =
            occasion_name
                ? `\nThey are currently focused on the "${occasion_name}" occasion in the app.`
                : ''
        const system = `${CHAT_SYSTEM_BASE}\n\n${catalog}${occasionHint}${budgetHint}`

        let reply = ''
        let model = runtime.primaryModel
        let source: 'claude' | 'openrouter' | 'gemini' = runtime.provider

        if (runtime.provider === 'openrouter') {
            const joined = history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.text }))
            joined.push({ role: 'user', content: message })
            const out = await withTimeout(
                chatWithOpenRouter({
                    model: runtime.openrouterModel || runtime.primaryModel,
                    system,
                    messages: joined,
                    temperature: 0.6,
                    maxTokens: 4096,
                    sessionId: session_id || `chat-${Date.now()}`,
                }),
                45_000,
                'OpenRouter chat'
            )
            reply = sanitizeAssistantReplyText(out.text)
            model = out.model
            source = 'openrouter'
        } else if (runtime.provider === 'gemini') {
            const historyText = history
                .map((h) => `${h.role === 'assistant' ? 'Assistant' : 'User'}: ${h.text}`)
                .join('\n\n')
            const out = await withTimeout(
                generateTextWithGemini({
                    model: runtime.geminiModel || runtime.primaryModel,
                    systemInstruction: system,
                    userText: `${historyText ? `${historyText}\n\n` : ''}User: ${message}\nAssistant:`,
                    temperature: 0.6,
                    maxOutputTokens: 4096,
                }),
                45_000,
                'Gemini chat'
            )
            reply = sanitizeAssistantReplyText(out.text)
            model = out.model
            source = 'gemini'
        } else {
            const client = getAnthropicClient()
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
                    model: runtime.claudeModel || runtime.primaryModel,
                    max_tokens: 4096,
                    temperature: 0.6,
                    system,
                    messages,
                }),
                45_000,
                'Chat'
            )
            reply = sanitizeAssistantReplyText(extractAnthropicText(raw))
            model = runtime.claudeModel || runtime.primaryModel
            source = 'claude'
        }

        if (!reply) {
            return NextResponse.json({ error: 'AI returned an empty reply' }, { status: 502 })
        }

        return NextResponse.json({
            reply: reply.slice(0, 12_000),
            ai_meta: { source, model },
        })
    } catch (e) {
        const message = e instanceof Error ? e.message : ''
        if (/anthropic|claude/i.test(message)) {
            const { status, body } = anthropicErrorToHttp(e)
            return NextResponse.json(body, { status })
        }
        return NextResponse.json({ error: message || 'AI chat failed' }, { status: 500 })
    }
}
