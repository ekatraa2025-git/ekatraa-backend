import { supabase } from '@/lib/supabase/server'

/** Same UUID as migrations/051_e_invite_catalog_service.sql — used for cart / order line items. */
export const E_INVITE_CATALOG_SERVICE_ID = 'e1000001-0000-4000-8000-000000000001'

/** Default prices; actual runtime values can be overridden in platform_settings. */
export const E_INVITE_STATIC_INR = 300
export const E_INVITE_ANIMATED_INR = 500

export type EInviteMediaKind = 'static' | 'animated'

export async function getEInvitePricingConfig(): Promise<{ static_inr: number; animated_inr: number }> {
    const { data } = await supabase
        .from('platform_settings')
        .select('e_invite_static_inr, e_invite_animated_inr')
        .eq('id', 'default')
        .maybeSingle()

    const staticInr = Math.max(1, Math.round(Number(data?.e_invite_static_inr || E_INVITE_STATIC_INR)))
    const animatedInr = Math.max(1, Math.round(Number(data?.e_invite_animated_inr || E_INVITE_ANIMATED_INR)))
    return { static_inr: staticInr, animated_inr: animatedInr }
}

export async function priceInrForMediaKind(kind: EInviteMediaKind): Promise<number> {
    const cfg = await getEInvitePricingConfig()
    return kind === 'animated' ? cfg.animated_inr : cfg.static_inr
}
