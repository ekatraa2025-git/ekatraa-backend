import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
        supabase.from('cart_items').select('id, service_id, quantity, unit_price, options, created_at, offerable_services(id, name, image_url, price_min, price_max)').eq('cart_id', id),
    ])

    if (cartError || !cart) {
        return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    }
    if (itemsError) {
        return NextResponse.json({ ...cart, items: [] })
    }

    const itemsWithService = (items ?? []).map((item: { offerable_services: unknown }) => ({
        ...item,
        service: item.offerable_services,
        offerable_services: undefined,
    }))

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
    const body = await req.json().catch(() => ({}))
    const allowed = [
        'event_name', 'event_date', 'guest_count', 'location_preference',
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
