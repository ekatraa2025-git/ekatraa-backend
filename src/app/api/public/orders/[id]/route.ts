import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/orders/[id]
 * Order detail with items and status history.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
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
        .select('id, vendor_id, service_type, amount, status, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: false })

    let quotes: Array<Record<string, unknown>> = (quotations ?? []) as Array<Record<string, unknown>>
    if (quotes.length > 0) {
        const vendorIds = [...new Set(quotes.map((q) => q.vendor_id as string).filter(Boolean))]
        const { data: vendors } = await supabase
            .from('vendors')
            .select('id, business_name')
            .in('id', vendorIds)
        const vendorMap = new Map((vendors ?? []).map((v: { id: string; business_name: string }) => [v.id, v.business_name]))
        quotes = quotes.map((q) => ({
            ...q,
            vendor_name: q.vendor_id ? vendorMap.get(q.vendor_id as string) ?? null : null,
        }))
    }

    return NextResponse.json({
        ...order,
        items: items ?? [],
        status_history: history ?? [],
        quotes,
        vendor_quotes: quotes,
    })
}
