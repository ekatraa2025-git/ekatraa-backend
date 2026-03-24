export type NarrativeAllocationLine = {
    category_id: string
    name: string
    percentage: number
    allocated_inr: number
}

export type GeminiNarrativeResult = {
    intro: string
    tips: string[]
    planning_reminders: string[]
    disclaimer: string
}

const SYSTEM_INSTRUCTION = `You are an event budgeting assistant for the Ekatraa app in India.
You MUST respond with valid JSON only, matching this shape:
{"intro":"string","tips":["string"],"planning_reminders":["string"],"disclaimer":"string"}
Rules:
- Use ONLY the facts given in the user message (occasion name, total budget INR, category names, percentages, allocated INR per category, optional guest band). Do not invent vendors, services, prices, discounts, or guarantees.
- tips: 3 to 6 short bullet strings; practical and generic (buffers, priorities, tracking spend).
- planning_reminders: 2 to 4 short strings (timeline, contingencies, reviewing allocations).
- disclaimer must state that figures are illustrative and actual prices and availability are in the app.
- Write in clear English; rupee amounts must match those provided in the input only.`

export async function generateBudgetNarrative(input: {
    occasion_name: string
    budget_inr: number
    guest_band: string | null
    allocation_lines: NarrativeAllocationLine[]
}): Promise<{ parsed: GeminiNarrativeResult; model: string; duration_ms: number }> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || !apiKey.trim()) {
        throw new Error('GEMINI_API_KEY is not configured')
    }

    const model = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim()
    const base = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com').replace(
        /\/$/,
        ''
    )
    const url = `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

    const allocText = input.allocation_lines
        .map(
            (l) =>
                `- ${l.name} (id ${l.category_id}): ${l.percentage.toFixed(2)}% → ₹${Math.round(l.allocated_inr)} allocated`
        )
        .join('\n')

    const userText = `Occasion: ${input.occasion_name}
Total budget (INR): ${Math.round(input.budget_inr)}
Guest context: ${input.guest_band ?? 'not specified'}
Category allocations:
${allocText}

Produce the JSON object as specified.`

    const started = Date.now()
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }],
            },
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            generationConfig: {
                temperature: 0.3,
                responseMimeType: 'application/json',
            },
        }),
        signal: AbortSignal.timeout(25_000),
    })

    const duration_ms = Date.now() - started

    if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 500)}`)
    }

    const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text || typeof text !== 'string') {
        throw new Error('Gemini returned no text content')
    }

    let parsedRaw: unknown
    try {
        parsedRaw = JSON.parse(text) as unknown
    } catch {
        throw new Error('Gemini returned non-JSON text')
    }

    const p = parsedRaw as Record<string, unknown>
    const intro = typeof p.intro === 'string' ? p.intro : ''
    const tips = Array.isArray(p.tips) ? p.tips.filter((x): x is string => typeof x === 'string') : []
    const planning_reminders = Array.isArray(p.planning_reminders)
        ? p.planning_reminders.filter((x): x is string => typeof x === 'string')
        : []
    const disclaimer = typeof p.disclaimer === 'string' ? p.disclaimer : ''

    if (!intro.trim() || tips.length === 0 || !disclaimer.trim()) {
        throw new Error('Gemini JSON missing required fields')
    }

    return {
        parsed: { intro, tips, planning_reminders, disclaimer },
        model,
        duration_ms,
    }
}
