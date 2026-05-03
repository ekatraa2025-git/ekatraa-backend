import { NextResponse } from 'next/server'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { chatWithOpenRouter } from '@/lib/openrouter-client'

type Body = {
    eventName?: string
    eventDate?: string
    eventTime?: string
    venueName?: string
    venueAddress?: string
    hostNames?: string
    message?: string
    colorTheme?: string
    variation?: string
    mode?: 'samples' | 'final'
    samples?: string[]
    selectedSampleIndex?: number
    templateType?: 'image' | 'video'
    session_id?: string
}

/**
 * POST /api/public/invitations/generate
 * Uses OpenRouter-backed model to produce invitation copy.
 */
export async function POST(req: Request) {
    try {
        let body: Body = {}
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const mode = body.mode === 'samples' ? 'samples' : 'final'
        const templateType =
            String(body.templateType || '').toLowerCase() === 'video' ? 'video' : 'image'
        const ctx = [
            `Event: ${body.eventName || 'Event'}`,
            `Date: ${body.eventDate || ''}`,
            `Time: ${body.eventTime || ''}`,
            `Venue: ${body.venueName || ''}${body.venueAddress ? `, ${body.venueAddress}` : ''}`,
            `Hosts: ${body.hostNames || ''}`,
            body.message ? `Note: ${body.message}` : '',
            `Visual theme color: ${body.colorTheme || 'gold'}`,
            `Style variation: ${body.variation || 'classic'}`,
            `Template type: ${templateType}`,
        ]
            .filter(Boolean)
            .join('\n')
        const runtime = await getAiRuntimeSettings()
        const model = runtime.openrouterModel || runtime.primaryModel

        if (mode === 'samples') {
            const out = await chatWithOpenRouter({
                model,
                sessionId: String(body.session_id || '').trim() || `invite-samples-${Date.now()}`,
                messages: [
                    {
                        role: 'user',
                        content: `You are a creative copywriter for Indian celebrations.
Context:
${ctx}

Return ONLY valid JSON (no markdown) in this exact shape:
{"samples":["...","...","..."]}

Rules:
- 3 samples
- each sample 120-220 words
- warm, festive, and WhatsApp-ready
- if template type is video, use cinematic narration style
- if template type is image, use elegant invite-card style
- no extra keys`,
                    },
                ],
                temperature: 0.7,
                maxTokens: 2048,
            })
            const raw = String(out.text || '').trim()
            const parsed = tryParseJson(raw)
            const samples = normalizeSamples(parsed?.samples, raw)
            return NextResponse.json({ samples, final: null as string | null })
        }

        const samplesHint =
            Array.isArray(body.samples) && body.samples.length
                ? `Earlier samples:\n${body.samples.slice(0, 3).map((s, i) => `${i + 1}. ${s.slice(0, 400)}...`).join('\n')}`
                : ''

        const out = await chatWithOpenRouter({
            model,
            sessionId: String(body.session_id || '').trim() || `invite-final-${Date.now()}`,
            messages: [
                {
                    role: 'user',
                    content: `You are a premium invitation designer for Indian events.
Context:
${ctx}

${samplesHint}

Produce ONE final, highly creative, unique invitation message for WhatsApp (140–260 words).
Rich imagery, elegant tone, match the ${body.variation || 'classic'} style and ${body.colorTheme || 'gold'} mood.
No markdown. Plain text only.`,
                },
            ],
            temperature: 0.65,
            maxTokens: 2048,
        })
        const final = String(out.text || '').trim()
        return NextResponse.json({ samples: [] as string[], final: final || '' })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not generate invitation text'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

function tryParseJson(s: string): { samples?: unknown } | null {
    try {
        const t = s.trim()
        const start = t.indexOf('{')
        const end = t.lastIndexOf('}')
        if (start >= 0 && end > start) {
            return JSON.parse(t.slice(start, end + 1)) as { samples?: unknown }
        }
        return JSON.parse(t) as { samples?: unknown }
    } catch {
        return null
    }
}

function normalizeSamples(samples: unknown, raw: string): string[] {
    if (Array.isArray(samples)) {
        const out = samples.map((x) => String(x || '').trim()).filter(Boolean)
        if (out.length >= 2) return out.slice(0, 3)
    }
    const parts = raw.split(/\n---+\n|===+/).map((p) => p.trim()).filter((p) => p.length > 40)
    if (parts.length >= 2) return parts.slice(0, 3)
    return [raw.slice(0, 2000) || 'Invitation text could not be split into samples.']
}
