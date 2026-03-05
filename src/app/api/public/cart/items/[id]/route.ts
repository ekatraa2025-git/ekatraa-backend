import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/public/cart/items/[id]
 * Update quantity, unit_price, or options for a cart item.
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Item id required' }, { status: 400 })
    }

    try {
        const body = await req.json()
        const updates: { quantity?: number; unit_price?: number; options?: unknown } = {}
        if (body.quantity !== undefined) updates.quantity = Math.max(1, Number(body.quantity))
        if (body.unit_price !== undefined) updates.unit_price = body.unit_price
        if (body.options !== undefined) updates.options = body.options

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('cart_items')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json(data)
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}

/**
 * DELETE /api/public/cart/items/[id]
 */
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Item id required' }, { status: 400 })
    }

    const { error } = await supabase.from('cart_items').delete().eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ deleted: true })
}
