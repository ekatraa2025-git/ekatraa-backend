import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'
import { resolveVendorOwnerPhoneDigits } from '@/lib/vendor-owner-phone'

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

    let registered_phone_hint: string | null = null
    if (!auth.isTeamMember) {
        const { data: vendorRow } = await supabase
            .from('vendors')
            .select('phone')
            .eq('id', auth.vendorId)
            .maybeSingle()
        const digits = await resolveVendorOwnerPhoneDigits(req, vendorRow?.phone as string | null | undefined)
        registered_phone_hint =
            digits.length === 10 ? `+91 ••••••${digits.slice(-4)}` : null
    }

    return NextResponse.json({
        vendor_id: auth.vendorId,
        requester_user_id: auth.requesterUserId,
        is_team_member: auth.isTeamMember,
        team_member_id: auth.teamMemberId,
        team_role: auth.teamRole,
        team_member: teamMember,
        registered_phone_hint: registered_phone_hint,
    })
}
