import { NextResponse } from 'next/server'
import { listOpenRouterModels } from '@/lib/openrouter-client'

/**
 * GET /api/admin/openrouter/models?output_modalities=image|all|text,image
 * Defaults to all models (OpenRouter default is text-only without this param; we request `all` when omitted).
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const raw = searchParams.get('output_modalities') || searchParams.get('outputModalities')
        const outputModalities = raw?.trim() || 'all'
        const models = await listOpenRouterModels({ outputModalities })
        return NextResponse.json({ models })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Could not load OpenRouter models' },
            { status: 500 }
        )
    }
}
