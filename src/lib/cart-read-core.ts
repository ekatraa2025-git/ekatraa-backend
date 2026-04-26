import type { SupabaseClient } from '@supabase/supabase-js'

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
                'id, service_id, quantity, unit_price, options, created_at, offerable_services(id, name, image_url, price_min, price_max, category_id, qty_label_basic, qty_label_classic_value, qty_label_signature, qty_label_prestige, qty_label_royal, qty_label_imperial, sub_variety_basic, sub_variety_classic_value, sub_variety_signature, sub_variety_prestige, sub_variety_royal, sub_variety_imperial, categories(id, name))'
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
