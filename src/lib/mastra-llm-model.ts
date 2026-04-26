/**
 * Mastra agent model IDs use `provider/model` (see @mastra/core model router).
 * We use Google Gemini for planning agents — cheapest production defaults per Gemini API pricing.
 */
export const DEFAULT_MASTRA_GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'

/** Gemini model id only (e.g. gemini-3.1-flash-lite-preview, gemini-3-flash-preview). */
export function getMastraGeminiModelId(): string {
    return (process.env.MASTRA_GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_MASTRA_GEMINI_MODEL).trim()
}

/** Full router id for Mastra Agent `model` field. */
export function getMastraLlmModelString(): string {
    return `google/${getMastraGeminiModelId()}`
}
