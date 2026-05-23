import { normalizeVoiceLanguageCode, SUPPORTED_VOICE_LANGUAGE_CODES } from '@/lib/voice-languages'

const SARVAM_SUPPORTED = new Set<string>([
    ...SUPPORTED_VOICE_LANGUAGE_CODES,
    'or-IN', // Sarvam Odia code (app uses od-IN)
])

/** Normalize client language codes for Sarvam STT/TTS APIs. */
export function normalizeSarvamLanguageCode(raw?: string | null, fallback = 'en-IN'): string {
    const trimmed = (raw || '').trim()
    if (!trimmed) return fallback

    const voice = normalizeVoiceLanguageCode(trimmed)
    if (voice === 'od-IN') return 'or-IN'
    if (voice) return voice

    const lower = trimmed.toLowerCase()
    if (lower === 'or-in') return 'or-IN'
    if (lower === 'od-in') return 'or-IN'

    const canonical = trimmed.slice(0, 16)
    if (SARVAM_SUPPORTED.has(canonical)) return canonical

    return fallback
}
