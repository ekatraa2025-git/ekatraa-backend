import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const [
            { count: vendorsCount },
            { count: ordersCount },
            { count: servicesCount },
            { count: quotationsCount }
        ] = await Promise.all([
            supabase.from('vendors').select('*', { count: 'exact', head: true }),
            supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
            supabase.from('services').select('*', { count: 'exact', head: true }),
            supabase.from('quotations').select('*', { count: 'exact', head: true })
        ])

        return NextResponse.json({
            vendors: vendorsCount || 0,
            orders: ordersCount || 0,
            services: servicesCount || 0,
            quotations: quotationsCount || 0
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
