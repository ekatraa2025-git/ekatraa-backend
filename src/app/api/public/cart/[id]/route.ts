import { supabase } from '@/lib/supabase/server'
import { assertCartReadableByActor, getCartWithItems } from '@/lib/cart-read-core'
import { CART_OWNER_SESSION_HEADER } from '@/lib/cart-owner-http'
import { NextResponse } from 'next/server'
import { resolveOptionalBearerUser } from '@/lib/user-auth'

/**
 * GET /api/public/cart/[id]
 * Returns cart with items (and service details).
 * Ownership: Bearer must match carts.user_id when set; anonymous carts require
 * `${CART_OWNER_SESSION_HEADER}: <carts.session_id>` matching the DB row (parity with Mastra `get_cart_summary`).
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const auth = await resolveOptionalBearerUser(req)
    if (auth.error) return auth.error

    const sessionClaimRaw = req.headers.get(CART_OWNER_SESSION_HEADER)?.trim().slice(0, 512) || ''

    const result = await getCartWithItems(supabase, id)
    if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: result.status })
    }

    const gate = assertCartReadableByActor(result.cart, {
        authenticatedUserId: auth.userId,
        trustedCartSessionId: sessionClaimRaw || null,
    })
    if (!gate.ok) {
        return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    return NextResponse.json({ ...result.cart, items: result.items })
}

/**
 * PATCH /api/public/cart/[id]
 * Update cart event/contact details before checkout.
 * Ownership: same as GET — Bearer must match carts.user_id when set; anonymous carts require
 * `${CART_OWNER_SESSION_HEADER}: <carts.session_id>`.
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Cart id required' }, { status: 400 })
    }

    const auth = await resolveOptionalBearerUser(req)
    if (auth.error) return auth.error

    const sessionClaimRaw = req.headers.get(CART_OWNER_SESSION_HEADER)?.trim().slice(0, 512) || ''

    const { data: cartRow, error: cartFetchErr } = await supabase.from('carts').select('*').eq('id', id).single()

    if (cartFetchErr || !cartRow) {
        return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    }

    const gate = assertCartReadableByActor(cartRow as Record<string, unknown>, {
        authenticatedUserId: auth.userId,
        trustedCartSessionId: sessionClaimRaw || null,
    })
    if (!gate.ok) {
        return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    const body = await req.json().catch(() => ({}))
    const allowed = [
        'event_name', 'event_role', 'event_date', 'guest_count', 'location_preference',
        'venue_preference', 'planned_budget', 'planned_budget_inr', 'contact_name', 'contact_mobile', 'contact_email',
    ]
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('carts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
}
