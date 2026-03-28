import { extractAnthropicText, getAnthropicClient, getClaudeModel, withTimeout } from '@/lib/claude-client'

export type NarrativeAllocationLine = {
    category_id: string
    name: string
    percentage: number
    allocated_inr: number
}

export type BudgetNarrativeResult = {
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
- tips: 4 to 6 very short lines (one idea each). Easy to skim. Examples of tone: keep a small cushion for surprises; decide what matters most first; check numbers with family. You may refer to the spending areas by name when it helps.
- planning_reminders: 2 or 3 short lines about timing, confirming guest numbers, or revisiting the plan—spoken like a calm friend.
- disclaimer: one short sentence that the real prices and options are the ones shown in the Ekatraa app.

Hard rules:
- Use only the occasion name, guest note, total budget, and the spending areas and rupee amounts we list. Do not invent vendors, packages, discounts, or new numbers.
- Keep sentences short. No bullet points inside the intro string.
- Do not mention AI models, "Claude", Anthropic, or your model name anywhere in the JSON strings.`

export async function generateBudgetNarrative(input: {
    occasion_name: string
    budget_inr: number
    guest_band: string | null
    allocation_lines: NarrativeAllocationLine[]
}): Promise<{ parsed: BudgetNarrativeResult; model: string; duration_ms: number }> {
    const client = getAnthropicClient()
    const model = getClaudeModel()

    const rupee = (n: number) =>
        `₹${Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

    const allocText = input.allocation_lines
        .map((l) => {
            const pct = Math.round(l.percentage * 10) / 10
            return `- ${l.name}: about ${rupee(l.allocated_inr)} (${pct}% of the total plan below)`
        })
        .join('\n')

    const userText = `Occasion: ${input.occasion_name}
Total plan budget: ${rupee(input.budget_inr)}
Guests: ${input.guest_band ?? 'not mentioned'}

How the budget is split (use these names and amounts only; do not change the numbers):
${allocText}

Write the JSON object now.`

    const started = Date.now()
    const msg = await withTimeout(
        client.messages.create({
            model,
            max_tokens: 2048,
            temperature: 0.3,
            system: SYSTEM_INSTRUCTION,
            messages: [{ role: 'user', content: userText }],
        }),
        25_000,
        'Budget narrative'
    )
    const duration_ms = Date.now() - started

    const text = extractAnthropicText(msg).trim()
    if (!text) {
        throw new Error('AI returned no text content')
    }

    let parsedRaw: unknown
    try {
        parsedRaw = JSON.parse(text) as unknown
    } catch {
        throw new Error('AI returned non-JSON text')
    }

    const p = parsedRaw as Record<string, unknown>
    const intro = typeof p.intro === 'string' ? p.intro : ''
    const tips = Array.isArray(p.tips) ? p.tips.filter((x): x is string => typeof x === 'string') : []
    const planning_reminders = Array.isArray(p.planning_reminders)
        ? p.planning_reminders.filter((x): x is string => typeof x === 'string')
        : []
    const disclaimer = typeof p.disclaimer === 'string' ? p.disclaimer : ''

    if (!intro.trim() || tips.length === 0 || !disclaimer.trim()) {
        throw new Error('AI JSON missing required fields')
    }

    return {
        parsed: { intro, tips, planning_reminders, disclaimer },
        model,
        duration_ms,
    }
}
