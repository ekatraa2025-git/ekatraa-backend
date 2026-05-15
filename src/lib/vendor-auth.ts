import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export type VendorPrincipal = {
    vendorId: string
    requesterUserId: string
    isTeamMember: boolean
    teamMemberId: string | null
    teamRole: string | null
}

function normalizePhone(value: string | null | undefined): string {
    return String(value || '').replace(/\D/g, '').slice(-10)
}

function phoneLookupVariants(digits10: string): string[] {
    if (digits10.length !== 10) return []
    return [`+91${digits10}`, digits10, `91${digits10}`]
}

/** Owner row when JWT subject differs from `vendors.id` (e.g. admin created vendor before auth). */
async function findOwnerVendorIdByContact(
    serverSupabase: SupabaseClient,
    user: { id: string; phone?: string | null; email?: string | null }
): Promise<string | null> {
    const digits = normalizePhone(user.phone)
    const variants = phoneLookupVariants(digits)
    if (variants.length > 0) {
        const { data } = await serverSupabase
            .from('vendors')
            .select('id')
            .in('phone', variants)
            .limit(1)
            .maybeSingle()
        if (data?.id) return String(data.id)
    }

    const email = String(user.email || '')
        .trim()
        .toLowerCase()
    if (email) {
        const { data } = await serverSupabase
            .from('vendors')
            .select('id, email')
            .ilike('email', email)
            .limit(1)
            .maybeSingle()
        if (data?.id) return String(data.id)
    }

    return null
}

/**
 * Extracts vendor ID from Authorization Bearer token (Supabase JWT).
 * Returns { vendorId, error } - error is a NextResponse if auth failed.
 */
export async function getVendorFromRequest(req: Request): Promise<
    | (VendorPrincipal & { error: null })
    | { vendorId: null; error: NextResponse; requesterUserId?: null; isTeamMember?: false; teamMemberId?: null; teamRole?: null }
> {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')

    if (!token) {
        return {
            vendorId: null,
            error: NextResponse.json({ error: 'Authorization required. Pass Bearer token.' }, { status: 401 }),
        }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        return {
            vendorId: null,
            error: NextResponse.json({ error: 'Server auth configuration missing' }, { status: 500 }),
        }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user?.id) {
        return {
            vendorId: null,
            error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }),
        }
    }

    // Verify user is a vendor (use server client for DB access)
    const { supabase: serverSupabase } = await import('@/lib/supabase/server')
    const { data: vendor } = await serverSupabase
        .from('vendors')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

    if (vendor) {
        return {
            vendorId: user.id,
            requesterUserId: user.id,
            isTeamMember: false,
            teamMemberId: null,
            teamRole: null,
            error: null,
        }
    }

    const ownerVendorId = await findOwnerVendorIdByContact(serverSupabase, user)
    if (ownerVendorId) {
        return {
            vendorId: ownerVendorId,
            requesterUserId: user.id,
            isTeamMember: false,
            teamMemberId: null,
            teamRole: null,
            error: null,
        }
    }

    let { data: teamMember } = await serverSupabase
        .from('vendor_team_members')
        .select('id, vendor_id, role, status')
        .eq('member_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

    if (!teamMember) {
        const normalizedUserPhone = normalizePhone(user.phone)
        if (normalizedUserPhone) {
            const { data: teamByPhone } = await serverSupabase
                .from('vendor_team_members')
                .select('id, vendor_id, role, status, member_user_id, phone')
                .eq('status', 'active')
                .eq('phone', normalizedUserPhone)
                .maybeSingle()

            if (teamByPhone?.id) {
                if (!teamByPhone.member_user_id) {
                    await serverSupabase
                        .from('vendor_team_members')
                        .update({ member_user_id: user.id, updated_at: new Date().toISOString() })
                        .eq('id', teamByPhone.id)
                }
                teamMember = teamByPhone
            }
        }
    }

    if (!teamMember?.vendor_id) {
        return {
            vendorId: null,
            error: NextResponse.json({ error: 'User is not a registered vendor or active team member' }, { status: 403 }),
        }
    }

    return {
        vendorId: teamMember.vendor_id,
        requesterUserId: user.id,
        isTeamMember: true,
        teamMemberId: teamMember.id,
        teamRole: teamMember.role ?? null,
        error: null,
    }
}

export async function isTeamMemberAssignedToOrder(principal: VendorPrincipal, orderId: string): Promise<boolean> {
    if (!principal.isTeamMember || !principal.teamMemberId) return true
    const { supabase: serverSupabase } = await import('@/lib/supabase/server')
    const { data: assignment } = await serverSupabase
        .from('vendor_order_team_assignments')
        .select('id')
        .eq('vendor_id', principal.vendorId)
        .eq('order_id', orderId)
        .eq('team_member_id', principal.teamMemberId)
        .limit(1)
        .maybeSingle()

    return !!assignment?.id
}
