import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin-session'

export async function GET() {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    const { data: quotations, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (quotations && quotations.length > 0) {
        const vendorIds = quotations.map(q => q.vendor_id).filter(id => id)
        const orderIds = quotations.map(q => q.order_id).filter(id => id)

        let vendorsMap = new Map()
        let ordersMap = new Map()

        if (vendorIds.length > 0) {
            const { data: vendors } = await supabase
                .from('vendors')
                .select('id, business_name, email, phone, city')
                .in('id', vendorIds)
            vendorsMap = new Map(vendors?.map(v => [v.id, v]) || [])
        }

        if (orderIds.length > 0) {
            const { data: orders } = await supabase
                .from('orders')
                .select('id, contact_name, contact_email, contact_mobile, event_date, location_preference, venue_preference, event_name')
                .in('id', orderIds)
            ordersMap = new Map(orders?.map(o => [o.id, o]) || [])
        }

        const data = quotations.map(quotation => ({
            ...quotation,
            vendor: quotation.vendor_id ? vendorsMap.get(quotation.vendor_id) || null : null,
            order: quotation.order_id ? ordersMap.get(quotation.order_id) || null : null
        }))

        return NextResponse.json(data)
    }

    return NextResponse.json(quotations || [])
}
