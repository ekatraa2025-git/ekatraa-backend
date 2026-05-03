import { NextResponse } from 'next/server'
import { E_INVITE_ANIMATED_INR, E_INVITE_STATIC_INR } from '@/lib/e-invite-pricing'

export async function GET() {
    return NextResponse.json({
        static_inr: E_INVITE_STATIC_INR,
        animated_inr: E_INVITE_ANIMATED_INR,
        currency: 'INR',
    })
}
