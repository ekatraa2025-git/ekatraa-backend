import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

export async function GET(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    let teamMember: Record<string, unknown> | null = null
    if (auth.isTeamMember && auth.teamMemberId) {
        const { data } = await supabase
            .from('vendor_team_members')
            .select('id, vendor_id, full_name, phone, role, status')
            .eq('id', auth.teamMemberId)
            .maybeSingle()
        teamMember = (data as Record<string, unknown> | null) ?? null
    }

    return NextResponse.json({
        vendor_id: auth.vendorId,
        requester_user_id: auth.requesterUserId,
        is_team_member: auth.isTeamMember,
        team_member_id: auth.teamMemberId,
        team_role: auth.teamRole,
        team_member: teamMember,
    })
}
