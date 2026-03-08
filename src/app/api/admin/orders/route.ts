import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Admin: list orders, filter by status and allocation. Joins vendors for vendor_name when allocated.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const allocated = searchParams.get('allocated')

    let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data: orders, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let result = orders ?? []
    if (allocated === 'false') {
        result = result.filter(
            (o: { vendor_id?: string | null }) => !o.vendor_id || o.vendor_id === '' || o.vendor_id === null
        )
    }

    if (!result.length) {
        return NextResponse.json(result)
    }

    const vendorIds = result
        .map((o: { vendor_id?: string | null }) => o.vendor_id)
        .filter((id: string | null | undefined) => id != null && id !== '')

    let vendorsMap = new Map<string, string>()
    if (vendorIds.length > 0) {
        const { data: vendors } = await supabase
            .from('vendors')
            .select('id, business_name')
            .in('id', vendorIds)
        vendorsMap = new Map(vendors?.map((v: { id: string; business_name: string }) => [v.id, v.business_name]) ?? [])
    }

    const data = result.map((order: { vendor_id?: string | null; [k: string]: unknown }) => ({
        ...order,
        vendor_name: order.vendor_id ? vendorsMap.get(order.vendor_id) ?? null : null,
    }))

    return NextResponse.json(data)
}
