import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/public/cart/items
 * Add item to cart. Body: { cart_id, service_id, quantity?, unit_price?, options? }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { cart_id, service_id, quantity = 1, unit_price, options } = body

        if (!cart_id || !service_id) {
            return NextResponse.json(
                { error: 'cart_id and service_id are required' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('cart_items')
            .upsert(
                {
                    cart_id,
                    service_id,
                    quantity: Math.max(1, Number(quantity)),
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
