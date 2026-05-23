/** Sarvam voice BCP-47 codes supported for STT, TTS, and Mastra voice replies. */

export const SUPPORTED_VOICE_LANGUAGE_CODES = [
    'en-IN',
    'hi-IN',
    'bn-IN',
    'ta-IN',
    'kn-IN',
    'pa-IN',
    'mr-IN',
    'gu-IN',
    'as-IN',
    'od-IN',
] as const

export type SupportedVoiceLanguageCode = (typeof SUPPORTED_VOICE_LANGUAGE_CODES)[number]

const SUPPORTED_VOICE_LANGUAGE_SET = new Set<string>(SUPPORTED_VOICE_LANGUAGE_CODES)

const VOICE_LANGUAGE_LABELS: Record<SupportedVoiceLanguageCode, string> = {
    'en-IN': 'English (en-IN)',
    'hi-IN': 'Hindi (hi-IN)',
    'bn-IN': 'Bengali (bn-IN)',
    'ta-IN': 'Tamil (ta-IN)',
    'kn-IN': 'Kannada (kn-IN)',
    'pa-IN': 'Punjabi (pa-IN)',
    'mr-IN': 'Marathi (mr-IN)',
    'gu-IN': 'Gujarati (gu-IN)',
    'as-IN': 'Assamese (as-IN)',
    'od-IN': 'Odia (od-IN)',
}

export function normalizeVoiceLanguageCode(raw?: string | null): SupportedVoiceLanguageCode | null {
    const code = (raw || '').trim()
    if (!code) return null
    if (code === 'or-IN') return 'od-IN'
    return SUPPORTED_VOICE_LANGUAGE_SET.has(code) ? (code as SupportedVoiceLanguageCode) : null
}

/** Mastra system hint: reply in the user's spoken language when it is one of our supported codes. */
export function buildVoiceReplyLanguageHint(preferredCode?: string | null): string {
    const preferred = normalizeVoiceLanguageCode(preferredCode) || 'en-IN'
    const supportedList = SUPPORTED_VOICE_LANGUAGE_CODES.map((code) => VOICE_LANGUAGE_LABELS[code]).join(', ')

    return `\nVoice mode is active. Keep replies concise, natural, and easy to speak aloud. Avoid markdown tables and links. Prefer short sentences and plain language.

Supported reply languages ONLY: ${supportedList}.

Always reply in the same language as the user's latest message when that language is clearly one of the supported languages above. If the user's language is mixed, ambiguous, or not in this list, reply in ${preferred} (their selected voice language). Never reply in any language outside this supported list.`
}
