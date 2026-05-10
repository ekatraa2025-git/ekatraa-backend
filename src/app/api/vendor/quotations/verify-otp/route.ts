import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

export async function POST(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const challengeId = String(body.challenge_id ?? '').trim()
    const otp = String(body.otp ?? '').trim()
    if (!challengeId || !otp) {
        return NextResponse.json({ error: 'challenge_id and otp are required' }, { status: 400 })
    }

    const { data: challenge, error } = await supabase
        .from('vendor_quote_otp_challenges')
        .select('id, vendor_id, team_member_id, otp_code, status, expires_at')
        .eq('id', challengeId)
        .eq('vendor_id', auth.vendorId)
        .maybeSingle()

    if (error || !challenge) {
        return NextResponse.json({ error: 'OTP challenge not found' }, { status: 404 })
    }
    if (auth.isTeamMember && auth.teamMemberId && challenge.team_member_id !== auth.teamMemberId) {
        return NextResponse.json({ error: 'OTP challenge does not belong to your assignment' }, { status: 403 })
    }
    if (challenge.status !== 'pending') {
        return NextResponse.json({ error: 'OTP challenge is no longer pending' }, { status: 400 })
    }
    if (new Date(challenge.expires_at) < new Date()) {
        await supabase
            .from('vendor_quote_otp_challenges')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', challenge.id)
        return NextResponse.json({ error: 'OTP challenge expired. Request a new OTP.' }, { status: 400 })
    }
    if (challenge.otp_code !== otp) {
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
    }

    const { data: updated, error: updateErr } = await supabase
        .from('vendor_quote_otp_challenges')
        .update({
            status: 'verified',
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', challenge.id)
        .select('id, vendor_id, order_id, team_member_id, status, expires_at, verified_at')
        .single()

    if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, challenge: updated })
}
