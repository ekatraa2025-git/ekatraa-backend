import { NextResponse } from 'next/server'
import { listOpenRouterModels } from '@/lib/openrouter-client'

export async function GET() {
    try {
        const models = await listOpenRouterModels()
        return NextResponse.json({ models })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Could not load OpenRouter models' },
            { status: 500 }
        )
    }
}
