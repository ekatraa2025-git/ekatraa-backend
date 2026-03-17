import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

/**
 * GET /api/vendor/orders/[id]
 * Order detail for the authenticated vendor (only if allocated to them).
 * Requires: Authorization: Bearer <supabase_access_token>
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .eq('vendor_id', auth.vendorId!)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: items } = await supabase
        .from('order_items')
        .select('id, service_id, name, quantity, unit_price, options')
        .eq('order_id', id)

    const { data: history } = await supabase
        .from('order_status_history')
        .select('status, note, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: true })

    const { data: quotations } = await supabase
        .from('quotations')
        .select('*')
        .eq('order_id', id)
        .eq('vendor_id', auth.vendorId!)
        .order('created_at', { ascending: false })

    const totalOrderPrice = (items ?? []).reduce(
        (sum: number, i: { quantity?: number | string; unit_price?: number | string }) =>
            sum + ((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)),
        0
    ) || Number((order as { total_amount?: number | string }).total_amount ?? 0)
    const advancePaid = Number((order as { advance_amount?: number | string }).advance_amount ?? 0)

    return NextResponse.json({
        ...order,
        items: items ?? [],
        status_history: history ?? [],
        quotations: quotations ?? [],
        quotation: (quotations ?? [])[0] ?? null,
        total_order_price: totalOrderPrice,
        advance_paid: advancePaid,
        balance_due: totalOrderPrice - advancePaid,
    })
}
