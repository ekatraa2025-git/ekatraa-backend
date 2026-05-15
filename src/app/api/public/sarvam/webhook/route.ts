import crypto from 'crypto'
import { NextResponse } from 'next/server'

function verifySignature(raw: string, secret: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex')
    try {
        return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))
    } catch {
        return false
    }
}

/**
 * Sarvam webhook receiver.
 * Configure `SARVAM_WEBHOOK_SECRET` if signature verification is enabled on Sarvam's side.
 */
export async function POST(req: Request) {
    const secret = process.env.SARVAM_WEBHOOK_SECRET?.trim()
    const raw = await req.text()

    if (secret) {
        const signature = req.headers.get('x-sarvam-signature') || req.headers.get('x-signature')
        if (!verifySignature(raw, secret, signature)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
    }

    let payload: unknown
    try {
        payload = JSON.parse(raw || '{}')
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    return NextResponse.json({
        ok: true,
        received: true,
        provider: 'sarvam',
        event_type:
            typeof payload === 'object' && payload && 'event' in payload && typeof (payload as { event?: unknown }).event === 'string'
                ? (payload as { event: string }).event
                : null,
    })
}
