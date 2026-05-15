import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

/** Full vendor business row for the authenticated principal (service role; bypasses client RLS). */
export async function GET(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const includeServices = (() => {
        try {
            const url = new URL(req.url)
            const raw = String(url.searchParams.get('include_services') || '')
                .trim()
                .toLowerCase()
            return raw === '1' || raw === 'true' || raw === 'yes'
        } catch {
            return false
        }
    })()

    const { data, error } = await supabase.from('vendors').select('*').eq('id', auth.vendorId).maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
        return NextResponse.json({ error: 'Vendor profile not found.' }, { status: 404 })
    }

    let serviceRows: unknown[] = []
    let serviceCount = 0
    if (includeServices) {
        const { data: services, error: servicesError } = await supabase
            .from('services')
            .select('*')
            .eq('vendor_id', auth.vendorId)
            .order('created_at', { ascending: false })

        if (servicesError) {
            return NextResponse.json({ error: servicesError.message }, { status: 500 })
        }
        serviceRows = Array.isArray(services) ? services : []
        serviceCount = serviceRows.length
    } else {
        const { count, error: countError } = await supabase
            .from('services')
            .select('id', { count: 'exact', head: true })
            .eq('vendor_id', auth.vendorId)
        if (countError) {
            return NextResponse.json({ error: countError.message }, { status: 500 })
        }
        serviceCount = Number(count || 0)
    }

    return NextResponse.json({
        vendor: data,
        vendor_id: auth.vendorId,
        is_team_member: auth.isTeamMember,
        services: includeServices ? serviceRows : [],
        service_count: serviceCount,
    })
}
