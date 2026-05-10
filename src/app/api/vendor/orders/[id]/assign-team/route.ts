import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

async function isVendorAllocated(orderId: string, vendorId: string): Promise<boolean> {
    const { data: order } = await supabase
        .from('orders')
        .select('id, vendor_id')
        .eq('id', orderId)
        .maybeSingle()

    if (!order) return false
    if ((order as { vendor_id?: string }).vendor_id === vendorId) return true

    const { data: items } = await supabase.from('order_items').select('id').eq('order_id', orderId)
    const itemIds = (items ?? []).map((i: { id: string }) => i.id)
    if (!itemIds.length) return false

    const { data: alloc } = await supabase
        .from('order_item_allocations')
        .select('id')
        .eq('vendor_id', vendorId)
        .in('order_item_id', itemIds)
        .limit(1)

    return (alloc?.length ?? 0) > 0
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { id: orderId } = await params
    if (!orderId) return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    if (!(await isVendorAllocated(orderId, auth.vendorId))) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data, error } = await supabase
        .from('vendor_order_team_assignments')
        .select('id, order_id, team_member_id, created_at, updated_at')
        .eq('vendor_id', auth.vendorId)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error
    if (auth.isTeamMember) {
        return NextResponse.json({ error: 'Only vendor owner can assign team members' }, { status: 403 })
    }

    const { id: orderId } = await params
    if (!orderId) return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    if (!(await isVendorAllocated(orderId, auth.vendorId))) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const teamMemberId = String(body.team_member_id ?? '').trim()
    if (!teamMemberId) {
        return NextResponse.json({ error: 'team_member_id is required' }, { status: 400 })
    }

    const { data: teamMember } = await supabase
        .from('vendor_team_members')
        .select('id, status')
        .eq('id', teamMemberId)
        .eq('vendor_id', auth.vendorId)
        .maybeSingle()

    if (!teamMember || teamMember.status !== 'active') {
        return NextResponse.json({ error: 'Active team member not found' }, { status: 404 })
    }

    const action = String(body.action ?? 'assign').toLowerCase()
    if (action === 'unassign') {
        const { error } = await supabase
            .from('vendor_order_team_assignments')
            .delete()
            .eq('vendor_id', auth.vendorId)
            .eq('order_id', orderId)
            .eq('team_member_id', teamMemberId)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, action: 'unassign' })
    }

    const { data, error } = await supabase
        .from('vendor_order_team_assignments')
        .upsert(
            {
                vendor_id: auth.vendorId,
                order_id: orderId,
                team_member_id: teamMemberId,
                assigned_by: auth.vendorId,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'order_id,team_member_id' }
        )
        .select('id, vendor_id, order_id, team_member_id, created_at, updated_at')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}
