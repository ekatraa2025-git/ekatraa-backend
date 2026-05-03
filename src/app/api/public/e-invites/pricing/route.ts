import { NextResponse } from 'next/server'
import { getEInvitePricingConfig, E_INVITE_CATALOG_SERVICE_ID } from '@/lib/e-invite-pricing'

/**
 * GET /api/public/e-invites/pricing
 * Public e-invite list prices + catalog service id for cart lines.
 */
export async function GET() {
    try {
        const { static_inr, animated_inr } = await getEInvitePricingConfig()
        return NextResponse.json({
            static_inr,
            animated_inr,
            catalog_service_id: E_INVITE_CATALOG_SERVICE_ID,
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
