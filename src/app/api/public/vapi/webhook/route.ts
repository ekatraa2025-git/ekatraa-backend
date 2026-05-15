import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { mastra } from '@/mastra'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { mastraAgentModelForInvocation } from '@/lib/mastra-llm-model'
import { toSpeechSafeText } from '@/lib/voice-text'

export async function POST(req: Request) {
    const secret = process.env.VAPI_WEBHOOK_SECRET?.trim()
    const raw = await req.text()

    if (secret) {
        const sig = req.headers.get('x-vapi-signature') || req.headers.get('x-signature')
        const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
        if (!sig || sig !== expected) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
    }

    let payload: unknown
    try {
        payload = JSON.parse(raw || '{}')
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const row = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
    const textCandidates = [
        typeof row.message === 'string' ? row.message : '',
        typeof row.transcript === 'string' ? row.transcript : '',
        typeof row.text === 'string' ? row.text : '',
    ].filter(Boolean)
    const inputText = textCandidates[0]?.trim() || ''
    if (!inputText) {
        return NextResponse.json({ ok: true, note: 'No user text found in webhook payload.' })
    }

    const threadId =
        (typeof row.thread_id === 'string' && row.thread_id.trim()) ||
        (typeof row.call_id === 'string' && `vapi-call-${row.call_id.trim()}`) ||
        'vapi-anonymous'

    const agent = mastra.getAgentById('event-planning-agent')
    const runtime = await getAiRuntimeSettings()
    const out = await agent.generate(
        [
            {
                role: 'system',
                content:
                    'Voice mode is active. Keep responses concise and plain-language for speech playback. Avoid markdown tables.',
            },
            { role: 'user', content: inputText.slice(0, 4000) },
        ],
        {
            model: mastraAgentModelForInvocation(runtime),
            memory: {
                thread: threadId,
                resource: 'ekatraa-vapi',
            },
        }
    )

    const reply = out.text?.trim() || 'Could not generate a reply.'
    return NextResponse.json({
        ok: true,
        reply,
        speech_text: toSpeechSafeText(reply, 1200),
        provider: 'mastra',
    })
}
