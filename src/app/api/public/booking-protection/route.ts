import { NextResponse } from 'next/server'
import { fetchPlatformProtectionSettings } from '@/lib/booking-protection'

/**
 * GET /api/public/booking-protection
 * Public read-only protection pricing config for checkout.
 */
export async function GET() {
    try {
        const settings = await fetchPlatformProtectionSettings()
        return NextResponse.json(settings)
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
