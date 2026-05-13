import type { SupabaseClient } from '@supabase/supabase-js'

/** Passed from route handlers into Mastra `RequestContext` for `get_cart_summary`. */
export type CartReadAccessContext = {
    authenticatedUserId: string | null
    /** Must match `carts.session_id` for anonymous carts (no `user_id`). */
    trustedCartSessionId: string | null
}

/**
 * Ensures callers cannot enumerate arbitrary cart UUIDs: user-bound carts require JWT ownership;
 * anonymous carts require the client's session secret that matches the row.
 */
export function assertCartReadableByActor(
    cart: Record<string, unknown>,
    ctx: CartReadAccessContext
): { ok: true } | { ok: false; status: 403; message: string } {
    const uid = cart.user_id != null && String(cart.user_id).trim() ? String(cart.user_id) : null

    if (uid) {
        if (!ctx.authenticatedUserId || ctx.authenticatedUserId !== uid) {
            return { ok: false, status: 403, message: 'Forbidden: cart belongs to another user' }
        }
        return { ok: true }
    }

    const sid = cart.session_id != null && String(cart.session_id).trim() ? String(cart.session_id).trim() : null
    if (!sid) {
        return { ok: false, status: 403, message: 'Forbidden: cart has no session anchor' }
    }

    const trusted = ctx.trustedCartSessionId?.trim() || ''
    if (!trusted || trusted !== sid) {
        return { ok: false, status: 403, message: 'Forbidden: anonymous cart session mismatch' }
    }

    return { ok: true }
}

/**
 * Load cart + items (same projection as GET /api/public/cart/[id]).
 */
export async function getCartWithItems(
    supabase: SupabaseClient,
    cartId: string
): Promise<
    | { ok: true; cart: Record<string, unknown>; items: unknown[] }
    | { ok: false; status: number; message: string }
> {
    if (!cartId?.trim()) {
        return { ok: false, status: 400, message: 'Cart id required' }
    }

    const [{ data: cart, error: cartError }, { data: items, error: itemsError }] = await Promise.all([
        supabase.from('carts').select('*').eq('id', cartId).single(),
        supabase
            .from('cart_items')
            .select(
                'id, service_id, quantity, unit_price, options, created_at, offerable_services(id, name, image_url, is_special_catalog, price_min, price_max, category_id, qty_label_basic, qty_label_classic_value, qty_label_signature, qty_label_prestige, qty_label_royal, qty_label_imperial, sub_variety_basic, sub_variety_classic_value, sub_variety_signature, sub_variety_prestige, sub_variety_royal, sub_variety_imperial, categories(id, name))'
            )
            .eq('cart_id', cartId),
    ])

    if (cartError || !cart) {
        return { ok: false, status: 404, message: 'Cart not found' }
    }

    const itemsWithService = (itemsError ? [] : items ?? []).map((item: Record<string, unknown>) => {
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

    return { ok: true, cart: cart as Record<string, unknown>, items: itemsWithService }
}
