import { supabase } from '@/lib/supabase/server'
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
    if (!id) {
        return NextResponse.json({ error: 'Cart id required' }, { status: 400 })
    }

    const [{ data: cart, error: cartError }, { data: items, error: itemsError }] = await Promise.all([
        supabase.from('carts').select('*').eq('id', id).single(),
        supabase
            .from('cart_items')
            .select(
                'id, service_id, quantity, unit_price, options, created_at, offerable_services(id, name, image_url, price_min, price_max, category_id, categories(id, name))'
            )
            .eq('cart_id', id),
    ])

    if (cartError || !cart) {
        return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    }
    if (itemsError) {
        return NextResponse.json({ ...cart, items: [] })
    }

    const itemsWithService = (items ?? []).map((item: Record<string, unknown>) => {
        const raw = item.offerable_services as Record<string, unknown> | null | undefined
        const os = Array.isArray(raw) ? (raw[0] as Record<string, unknown> | undefined) : raw
        let service: Record<string, unknown> | undefined
        if (os && typeof os === 'object') {
            const catRaw = os.categories as { id?: string; name?: string } | { id?: string; name?: string }[] | null | undefined
            const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw
            const category =
                cat && typeof cat === 'object' ? { id: cat.id, name: cat.name } : undefined
            const { categories: _c, ...rest } = os
            service = { ...rest, category }
        }
        return {
            ...item,
            service,
            offerable_services: undefined,
        }
    })

    return NextResponse.json({ ...cart, items: itemsWithService })
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
