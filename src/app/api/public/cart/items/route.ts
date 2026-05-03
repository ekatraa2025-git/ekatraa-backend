import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { E_INVITE_CATALOG_SERVICE_ID } from '@/lib/e-invite-pricing'

/**
 * POST /api/public/cart/items
 * Add item to cart. Body: { cart_id, service_id?, quantity?, unit_price?, options?, user_e_invite_id? }
 * When user_e_invite_id is set, Bearer auth is required; service_id and pricing are resolved server-side.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        let { cart_id, service_id, quantity = 1, unit_price, options } = body
        const user_e_invite_id_raw = body.user_e_invite_id

        if (!cart_id) {
            return NextResponse.json({ error: 'cart_id is required' }, { status: 400 })
        }

        if (user_e_invite_id_raw) {
            const { userId, error: authError } = await getEndUserIdFromRequest(req)
            if (authError) return authError

            const inviteId = String(user_e_invite_id_raw).trim()
            if (!inviteId) {
                return NextResponse.json({ error: 'user_e_invite_id is invalid' }, { status: 400 })
            }

            const { data: cart, error: cartError } = await supabase
                .from('carts')
                .select('id, user_id')
                .eq('id', cart_id)
                .single()

            if (cartError || !cart) {
                return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
            }

            if (cart.user_id && cart.user_id !== userId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }

            if (!cart.user_id) {
                const { error: patchErr } = await supabase
                    .from('carts')
                    .update({ user_id: userId })
                    .eq('id', cart_id)
                if (patchErr) {
                    return NextResponse.json({ error: patchErr.message }, { status: 400 })
                }
            }

            const { data: invite, error: invErr } = await supabase
                .from('user_e_invites')
                .select('id, user_id, price_inr, payment_status, media_kind, form_payload')
                .eq('id', inviteId)
                .single()

            if (invErr || !invite) {
                return NextResponse.json({ error: 'E-invite not found' }, { status: 404 })
            }
            if (invite.user_id !== userId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
            if (invite.payment_status === 'paid') {
                return NextResponse.json(
                    { error: 'This e-invite is already paid. Open your cart to continue checkout.' },
                    { status: 400 }
                )
            }

            const payload = (invite.form_payload && typeof invite.form_payload === 'object'
                ? invite.form_payload
                : {}) as Record<string, unknown>
            const eventName =
                (typeof payload.event_name === 'string' && payload.event_name.trim()) ||
                (typeof payload.eventName === 'string' && payload.eventName.trim()) ||
                ''
            const occasion = typeof payload.occasion === 'string' ? payload.occasion.trim() : ''
            const tierLabel = invite.media_kind === 'animated' ? 'Animated MP4' : 'Static image'

            service_id = E_INVITE_CATALOG_SERVICE_ID
            unit_price = Math.max(1, Math.round(Number(invite.price_inr || 0)))
            options = {
                ...(options && typeof options === 'object' && !Array.isArray(options) ? options : {}),
                line_kind: 'e_invite',
                user_e_invite_id: invite.id,
                tier_label: tierLabel,
                occasion: occasion || undefined,
                sub_variety: eventName || undefined,
            }
        }

        if (!service_id) {
            return NextResponse.json(
                { error: 'service_id is required (unless user_e_invite_id is provided)' },
                { status: 400 }
            )
        }

        const clampedQty = Math.min(100, Math.max(1, Math.floor(Number(quantity))))
        if (Number.isNaN(clampedQty) || clampedQty < 1) {
            return NextResponse.json({ error: 'quantity must be between 1 and 100' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('cart_items')
            .upsert(
                {
                    cart_id,
                    service_id,
                    quantity: clampedQty,
                    unit_price: unit_price ?? null,
                    options: options ?? null,
                },
                { onConflict: 'cart_id,service_id' }
            )
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json(data, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
