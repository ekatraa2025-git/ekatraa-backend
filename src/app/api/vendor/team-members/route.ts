import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

function normalizePhone(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '').slice(-10)
}

export async function GET(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    let query = supabase
        .from('vendor_team_members')
        .select('id, vendor_id, member_user_id, full_name, phone, role, status, created_at, updated_at')
        .eq('vendor_id', auth.vendorId)
        .order('created_at', { ascending: false })

    if (auth.isTeamMember && auth.teamMemberId) {
        query = query.eq('id', auth.teamMemberId)
    }

    const { data, error } = await query
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error
    if (auth.isTeamMember) {
        return NextResponse.json({ error: 'Only vendor owner can add team members' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const fullName = String(body.full_name ?? '').trim()
    const role = String(body.role ?? 'manager').trim().toLowerCase()
    const phone = normalizePhone(body.phone)

    if (!fullName) {
        return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
    }
    if (!phone || phone.length !== 10) {
        return NextResponse.json({ error: 'A valid 10-digit phone is required' }, { status: 400 })
    }
    if (!['manager', 'staff'].includes(role)) {
        return NextResponse.json({ error: 'role must be manager or staff' }, { status: 400 })
    }

    const { data: existing } = await supabase
        .from('vendor_team_members')
        .select('id')
        .eq('vendor_id', auth.vendorId)
        .eq('phone', phone)
        .maybeSingle()

    const payload = {
        vendor_id: auth.vendorId,
        full_name: fullName,
        phone,
        role,
        status: 'active',
        created_by: auth.vendorId,
        updated_at: new Date().toISOString(),
    }

    const { data, error } = existing?.id
        ? await supabase
            .from('vendor_team_members')
            .update(payload)
            .eq('id', existing.id)
            .select('id, vendor_id, member_user_id, full_name, phone, role, status, created_at, updated_at')
            .single()
        : await supabase
            .from('vendor_team_members')
            .insert(payload)
            .select('id, vendor_id, member_user_id, full_name, phone, role, status, created_at, updated_at')
            .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: existing?.id ? 200 : 201 })
}
