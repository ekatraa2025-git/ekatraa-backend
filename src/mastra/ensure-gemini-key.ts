/**
 * Mastra `google/...` models resolve the Google Generative AI API and read
 * an API key from process.env (see ModelsDevGateway.getApiKey in @mastra/core).
 * Common env names: GOOGLE_GENERATIVE_AI_API_KEY (@ai-sdk/google), GOOGLE_API_KEY,
 * or GEMINI_API_KEY. Mirror so one value in .env is enough.
 */
function firstKey(...keys: (string | undefined)[]): string {
    for (const k of keys) {
        const t = String(k || '').trim()
        if (t) return t
    }
    return ''
}

const fromAny = firstKey(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY
)

if (fromAny) {
    if (!String(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim()) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = fromAny
    }
    if (!String(process.env.GOOGLE_API_KEY || '').trim()) {
        process.env.GOOGLE_API_KEY = fromAny
    }
    if (!String(process.env.GEMINI_API_KEY || '').trim()) {
        process.env.GEMINI_API_KEY = fromAny
    }
}
