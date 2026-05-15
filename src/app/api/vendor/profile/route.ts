import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

/** Full vendor business row for the authenticated principal (service role; bypasses client RLS). */
export async function GET(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { data, error } = await supabase.from('vendors').select('*').eq('id', auth.vendorId).maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
        return NextResponse.json({ error: 'Vendor profile not found.' }, { status: 404 })
    }

    const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('vendor_id', auth.vendorId)
        .order('created_at', { ascending: false })

    if (servicesError) {
        return NextResponse.json({ error: servicesError.message }, { status: 500 })
    }

    const serviceRows = Array.isArray(services) ? services : []

    return NextResponse.json({
        vendor: data,
        vendor_id: auth.vendorId,
        is_team_member: auth.isTeamMember,
        services: serviceRows,
        service_count: serviceRows.length,
    })
}
