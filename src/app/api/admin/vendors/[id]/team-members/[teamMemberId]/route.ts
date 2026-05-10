import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'

function normalizePhone(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '').slice(-10)
}

export async function PATCH(
    req: Request,
    {
        params,
    }: {
        params: Promise<{ id: string; teamMemberId: string }>
    }
) {
    const { id: vendorId, teamMemberId } = await params
    if (!vendorId || !teamMemberId) {
        return NextResponse.json({ error: 'vendor id and team member id required' }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.full_name != null) {
        const fullName = String(body.full_name).trim()
        if (!fullName) return NextResponse.json({ error: 'full_name cannot be empty' }, { status: 400 })
        patch.full_name = fullName
    }
    if (body.phone != null) {
        const phone = normalizePhone(body.phone)
        if (!phone || phone.length !== 10)
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
        patch.phone = phone
    }
    if (body.role != null) {
        const role = String(body.role).toLowerCase()
        if (!['manager', 'staff'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        patch.role = role
    }
    if (body.status != null) {
        const status = String(body.status).toLowerCase()
        if (!['active', 'inactive'].includes(status))
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        patch.status = status
    }

    const { data, error } = await supabase
        .from('vendor_team_members')
        .update(patch)
        .eq('id', teamMemberId)
        .eq('vendor_id', vendorId)
        .select('id, vendor_id, member_user_id, full_name, phone, role, status, created_at, updated_at')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
}
