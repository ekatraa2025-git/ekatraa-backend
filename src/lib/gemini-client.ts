type GeminiGenerateOptions = {
    model: string
    systemInstruction?: string
    userText: string
    temperature?: number
    maxOutputTokens?: number
}

function getGeminiApiKey(): string {
    const key = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()
    if (!key) throw new Error('GEMINI_API_KEY is not configured')
    return key
}

export async function generateTextWithGemini(opts: GeminiGenerateOptions): Promise<{ text: string; model: string }> {
    const key = getGeminiApiKey()
    const model = String(opts.model || '').trim()
    if (!model) throw new Error('Gemini model is required')
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
            ...(opts.systemInstruction?.trim()
                ? { systemInstruction: { parts: [{ text: opts.systemInstruction.trim() }] } }
                : {}),
            contents: [
                {
                    role: 'user',
                    parts: [{ text: String(opts.userText || '') }],
                },
            ],
            generationConfig: {
                temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.6,
                maxOutputTokens: typeof opts.maxOutputTokens === 'number' ? opts.maxOutputTokens : 2048,
            },
        }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
        const message = String(
            json?.error?.message || json?.message || res.statusText || 'Gemini request failed'
        )
        throw new Error(message)
    }

    const parts = Array.isArray(json?.candidates?.[0]?.content?.parts) ? json.candidates[0].content.parts : []
    const text = parts
        .map((p: any) => String(p?.text || '').trim())
        .filter(Boolean)
        .join('\n')
        .trim()
    if (!text) throw new Error('Gemini returned empty reply')

    return { text, model }
}
