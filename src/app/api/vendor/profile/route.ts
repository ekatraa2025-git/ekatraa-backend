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

    return NextResponse.json({
        vendor: data,
        vendor_id: auth.vendorId,
        is_team_member: auth.isTeamMember,
    })
}
