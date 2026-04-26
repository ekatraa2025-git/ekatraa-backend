import { handleWorkflowStream } from '@mastra/ai-sdk'
import { createUIMessageStreamResponse } from 'ai'
import { NextResponse } from 'next/server'
import { mastra } from '@/mastra'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'

export async function OPTIONS(req: Request) {
    return new NextResponse(null, {
        status: 204,
        headers: planningCorsHeaders(req),
    })
}

/**
 * POST body: { inputData: { text, occasion_id?, budget_inr? } } or flat input fields.
 * Streams workflow `eventPlanningIntake` (human-gating hint step).
 */
export async function POST(req: Request) {
    const cors = planningCorsHeaders(req)
    try {
        const body = await req.json()
        const inputData = body.inputData ?? body
        const stream = await handleWorkflowStream({
            mastra,
            workflowId: 'eventPlanningIntake',
            version: 'v6',
            params: { inputData },
        })
        return createUIMessageStreamResponse({ stream, headers: cors })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Workflow failed'
        return NextResponse.json({ error: msg }, { status: 500, headers: cors })
    }
}
