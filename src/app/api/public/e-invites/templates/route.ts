import { NextResponse } from 'next/server'
import { E_INVITE_ANIMATED_INR, E_INVITE_STATIC_INR } from '@/lib/e-invite-pricing'

/**
 * Legacy catalog: template uploads are retired. App uses AI generation + fixed pricing.
 */
export async function GET() {
    return NextResponse.json([], {
        headers: {
            'x-e-invite-pricing-static': String(E_INVITE_STATIC_INR),
            'x-e-invite-pricing-animated': String(E_INVITE_ANIMATED_INR),
        },
    })
}
