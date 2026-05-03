import { NextResponse } from 'next/server'
import { getAiAppCatalogContext } from '@/lib/ai-app-context'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import {
    anthropicErrorToHttp,
    extractAnthropicText,
    getAnthropicClient,
    stripModelEchoLines,
    withTimeout,
} from '@/lib/claude-client'
import { chatWithOpenRouter } from '@/lib/openrouter-client'
import { generateTextWithGemini } from '@/lib/gemini-client'
import type { NarrativeAllocationLine } from '@/lib/claude-narrative'

type BudgetNarrativeResult = {
    intro: string
    tips: string[]
    planning_reminders: string[]
    disclaimer: string
}

const SYSTEM_INSTRUCTION = `You help families in India plan their event spend in very simple, friendly English.
Reply with ONLY valid JSON in this exact shape (no markdown):
{"intro":"string","tips":["string"],"planning_reminders":["string"],"disclaimer":"string"}

How to write:
- intro: 2 or 3 short sentences. Name the occasion. Say the total budget in plain words (use "rupees" or "lakhs" as people speak; use the same rupee amounts we give you). Mention 2–3 of the spending areas by name so it feels personal. No jargon: do not say INR, API, allocation, percentage, schema, or technical words.
- tips: 4 to 6 very short lines (one idea each). Easy to skim. You may refer to the spending areas by name when it helps.
- planning_reminders: 2 or 3 short lines about timing, confirming guest numbers, or revisiting the plan.
- disclaimer: one short sentence that the real prices and options are the ones shown in the Ekatraa app.

Hard rules:
- Use only the occasion name, guest note, total budget, and the spending areas and rupee amounts we list. Do not invent vendors, packages, discounts, or new numbers.
- Keep sentences short. No bullet points inside the intro string.
- Do not mention AI models, provider names, or your model name anywhere in the JSON strings.
- Do not add any extra top-level JSON keys (only intro, tips, planning_reminders, disclaimer).`

function parseNarrativeJson(rawText: string): BudgetNarrativeResult {
    let text = stripModelEchoLines(String(rawText || '')).trim()
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fence) text = fence[1].trim()
    const brace = text.indexOf('{')
    if (brace > 0) text = text.slice(brace)
    if (!text) throw new Error('AI returned no text content')
    const parsedRaw = JSON.parse(text) as Record<string, unknown>
    const intro = typeof parsedRaw.intro === 'string' ? stripModelEchoLines(parsedRaw.intro).trim() : ''
    const tips = Array.isArray(parsedRaw.tips)
        ? parsedRaw.tips
              .filter((x): x is string => typeof x === 'string')
              .map((x) => stripModelEchoLines(x).trim())
              .filter(Boolean)
        : []
    const planning_reminders = Array.isArray(parsedRaw.planning_reminders)
        ? parsedRaw.planning_reminders
              .filter((x): x is string => typeof x === 'string')
              .map((x) => stripModelEchoLines(x).trim())
              .filter(Boolean)
        : []
    const disclaimer = typeof parsedRaw.disclaimer === 'string' ? stripModelEchoLines(parsedRaw.disclaimer).trim() : ''
    if (!intro || tips.length === 0 || !disclaimer) throw new Error('AI JSON missing required fields')
    return { intro, tips, planning_reminders, disclaimer }
}

/**
 * POST /api/public/recommendations/narrative
 * Body: { occasion_name, budget_inr, guest_band?, city?, occasion_id?, allocation_lines: [{ category_id, name, percentage, allocated_inr }] }
 * Requires CLAUDE_API_KEY or ANTHROPIC_API_KEY. No substitute copy is returned on failure.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const occasion_name = typeof body.occasion_name === 'string' ? body.occasion_name.trim() : ''
        const budget_inr = Number(body.budget_inr)
        const guest_band =
            typeof body.guest_band === 'string' && body.guest_band.trim() ? body.guest_band.trim() : null
        const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim() : null
        const occasion_id =
            typeof body.occasion_id === 'string' && body.occasion_id.trim() ? body.occasion_id.trim() : null
        const session_id =
            typeof body.session_id === 'string' && body.session_id.trim() ? body.session_id.trim() : null
        const lines = body.allocation_lines

        if (!occasion_name) {
            return NextResponse.json({ error: 'occasion_name is required' }, { status: 400 })
        }
        if (!Number.isFinite(budget_inr) || budget_inr <= 0) {
            return NextResponse.json({ error: 'budget_inr must be a positive number' }, { status: 400 })
        }
        if (!Array.isArray(lines) || lines.length === 0) {
            return NextResponse.json({ error: 'allocation_lines must be a non-empty array' }, { status: 400 })
        }

        const allocation_lines: NarrativeAllocationLine[] = []
        for (const row of lines) {
            if (!row || typeof row !== 'object') continue
            const r = row as Record<string, unknown>
            const category_id = typeof r.category_id === 'string' ? r.category_id : ''
            const name = typeof r.name === 'string' ? r.name : ''
            const percentage = Number(r.percentage)
            const allocated_inr = Number(r.allocated_inr)
            if (!category_id || !name || !Number.isFinite(percentage) || !Number.isFinite(allocated_inr)) {
                return NextResponse.json(
                    { error: 'Each allocation_lines item needs category_id, name, percentage, allocated_inr' },
                    { status: 400 }
                )
            }
            allocation_lines.push({ category_id, name, percentage, allocated_inr })
        }

        const runtime = await getAiRuntimeSettings()
        const rupee = (n: number) => `₹${Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
        const allocText = allocation_lines
            .map((l) => {
                const pct = Math.round(l.percentage * 10) / 10
                return `- ${l.name}: about ${rupee(l.allocated_inr)} (${pct}% of the total plan below)`
            })
            .join('\n')
        const catalog = await getAiAppCatalogContext({ city: city ?? null, occasion_id: occasion_id ?? null })
        const systemInstruction = `${SYSTEM_INSTRUCTION}\n\n${catalog}\n\nYou may briefly mention browsing related services in the Ekatraa app when it fits the tone, using catalog names only.`
        const userText = `Occasion: ${occasion_name}
Total plan budget: ${rupee(budget_inr)}
Guests: ${guest_band ?? 'not mentioned'}

How the budget is split (use these names and amounts only; do not change the numbers):
${allocText}

Write the JSON object now.`
        const started = Date.now()
        let rawText = ''
        let model = runtime.primaryModel
        let source: 'claude' | 'openrouter' | 'gemini' = runtime.provider

        if (runtime.provider === 'openrouter') {
            const out = await withTimeout(
                chatWithOpenRouter({
                    model: runtime.openrouterModel || runtime.primaryModel,
                    system: systemInstruction,
                    messages: [{ role: 'user', content: userText }],
                    temperature: 0.3,
                    maxTokens: 2048,
                    sessionId: session_id || `narrative-${occasion_id || 'unknown'}-${Date.now()}`,
                }),
                25_000,
                'Narrative OpenRouter'
            )
            rawText = out.text
            model = out.model
            source = 'openrouter'
        } else if (runtime.provider === 'gemini') {
            const out = await withTimeout(
                generateTextWithGemini({
                    model: runtime.geminiModel || runtime.primaryModel,
                    systemInstruction,
                    userText,
                    temperature: 0.3,
                    maxOutputTokens: 2048,
                }),
                25_000,
                'Narrative Gemini'
            )
            rawText = out.text
            model = out.model
            source = 'gemini'
        } else {
            const client = getAnthropicClient()
            const raw = await withTimeout(
                client.messages.create({
                    model: runtime.claudeModel || runtime.primaryModel,
                    max_tokens: 2048,
                    temperature: 0.3,
                    system: systemInstruction,
                    messages: [{ role: 'user', content: userText }],
                }),
                25_000,
                'Budget narrative'
            )
            rawText = extractAnthropicText(raw)
            model = runtime.claudeModel || runtime.primaryModel
            source = 'claude'
        }
        const parsed = parseNarrativeJson(rawText)
        const duration_ms = Date.now() - started

        return NextResponse.json({
            narrative: parsed,
            ai_meta: { duration_ms, source, model },
        })
    } catch (e) {
        const message = e instanceof Error ? e.message : ''
        if (/anthropic|claude/i.test(message)) {
            const { status, body } = anthropicErrorToHttp(e)
            return NextResponse.json(body, { status })
        }
        return NextResponse.json({ error: message || 'Narrative generation failed' }, { status: 500 })
    }
}
