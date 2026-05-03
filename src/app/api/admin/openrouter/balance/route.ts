import { NextResponse } from 'next/server'
import { getOpenRouterBalance } from '@/lib/openrouter-client'

export async function GET() {
    try {
        const balance = await getOpenRouterBalance()
        return NextResponse.json(balance)
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Could not load OpenRouter balance' },
            { status: 500 }
        )
    }
}
