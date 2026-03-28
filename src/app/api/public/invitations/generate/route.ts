import { NextResponse } from 'next/server'
import {
    getAnthropicClient,
    getClaudeModel,
    extractAnthropicText,
    sanitizeAssistantReplyText,
    anthropicErrorToHttp,
} from '@/lib/claude-client'

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
}

/**
 * POST /api/public/invitations/generate
 * Uses Claude to produce 2–3 sample invitation texts or one final creative block.
 */
export async function POST(req: Request) {
    try {
        let body: Body = {}
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const mode = body.mode === 'final' ? 'final' : 'samples'
        const ctx = [
            `Event: ${body.eventName || 'Event'}`,
            `Date: ${body.eventDate || ''}`,
            `Time: ${body.eventTime || ''}`,
            `Venue: ${body.venueName || ''}${body.venueAddress ? `, ${body.venueAddress}` : ''}`,
            `Hosts: ${body.hostNames || ''}`,
            body.message ? `Note: ${body.message}` : '',
            `Visual theme color: ${body.colorTheme || 'gold'}`,
            `Style variation: ${body.variation || 'classic'}`,
        ]
            .filter(Boolean)
            .join('\n')

        const client = getAnthropicClient()
        const model = getClaudeModel()

        if (mode === 'samples') {
            const prompt = `You are a creative copywriter for Indian celebrations. ${ctx}

Return ONLY valid JSON, no markdown, no explanation. Shape:
{"samples":["...","...","..."]}
Each sample is a complete WhatsApp-ready invitation (150–280 words), warm and festive, different wording. Use occasional emoji sparingly.`

            const msg = await client.messages.create({
                model,
                max_tokens: 4096,
                messages: [{ role: 'user', content: prompt }],
            })
            const raw = sanitizeAssistantReplyText(extractAnthropicText(msg))
            const parsed = tryParseJson(raw)
            const samples = normalizeSamples(parsed?.samples, raw)
            return NextResponse.json({ samples, final: null as string | null })
        }

        const samplesHint =
            Array.isArray(body.samples) && body.samples.length
                ? `Earlier samples:\n${body.samples.slice(0, 3).map((s, i) => `${i + 1}. ${s.slice(0, 400)}...`).join('\n')}`
                : ''

        const prompt = `You are a premium invitation designer for Indian events. ${ctx}

${samplesHint}

Produce ONE final, highly creative, unique invitation message for WhatsApp (200–350 words). Rich imagery, elegant tone, match the ${body.variation || 'classic'} style and ${body.colorTheme || 'gold'} mood. No JSON — plain text only.`

        const msg = await client.messages.create({
            model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        })
        const final = sanitizeAssistantReplyText(extractAnthropicText(msg))
        return NextResponse.json({ samples: [] as string[], final: final || '' })
    } catch (e) {
        const mapped = anthropicErrorToHttp(e)
        return NextResponse.json(mapped.body, { status: mapped.status })
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
