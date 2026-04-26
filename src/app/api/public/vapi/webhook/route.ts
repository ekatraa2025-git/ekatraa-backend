import { NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Vapi webhook stub: verify optional signature, acknowledge receipt.
 * Wire to Mastra agent in Phase 3 when Vapi tool-call payloads are finalized.
 */
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

    try {
        JSON.parse(raw || '{}')
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    return NextResponse.json({
        ok: true,
        note: 'Vapi webhook received. Connect to Mastra agent stream when tool parity is ready.',
    })
}
