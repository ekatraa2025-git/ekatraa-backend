import { supabase } from '@/lib/supabase/server'
import { getCartWithItems } from '@/lib/cart-read-core'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * GET /api/public/cart/[id]
 * Returns cart with items (and service details).
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const result = await getCartWithItems(supabase, id)
    if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: result.status })
    }
    return NextResponse.json({ ...result.cart, items: result.items })
}

/**
 * PATCH /api/public/cart/[id]
 * Update cart event/contact details before checkout.
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Cart id required' }, { status: 400 })
    }

    // If the cart has a user_id, verify the caller owns it
    const { data: cartOwner } = await supabase.from('carts').select('user_id').eq('id', id).single()
    if (cartOwner?.user_id) {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError
        if (cartOwner.user_id !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
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
