/**
 * Mastra agent model IDs use `provider/model` (see @mastra/core model router).
 * Default to a **stable** GA Flash model. Preview/lite IDs (e.g. gemini-3.1-flash-lite-preview) often return
 * 503 "high demand" under load (provider capacity), which surfaces as AI_APICallError in chat.
 * Override with MASTRA_GEMINI_MODEL / GEMINI_MODEL or platform_settings.ai_gemini_model when needed.
 */
export const DEFAULT_MASTRA_GEMINI_MODEL = 'gemini-2.0-flash'

/** Gemini model id only (e.g. gemini-2.0-flash). */
export function getMastraGeminiModelId(): string {
    return (process.env.MASTRA_GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_MASTRA_GEMINI_MODEL).trim()
}

/** Full router id for Mastra Agent `model` field. */
export function getMastraLlmModelString(): string {
    return `google/${getMastraGeminiModelId()}`
}
