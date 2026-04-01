import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNotificationToVendor } from '@/lib/notifications'

/**
 * Admin: order detail + status transition (PATCH to update status and/or vendor_id for allocation).
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id)

    const itemIds = (items ?? []).map((i: { id: string }) => i.id)
    let allocationsByItemId = new Map<string, { vendor_id: string }>()
    if (itemIds.length > 0) {
        const { data: allocations } = await supabase
            .from('order_item_allocations')
            .select('order_item_id, vendor_id')
            .in('order_item_id', itemIds)
        for (const a of allocations ?? []) {
            allocationsByItemId.set((a as { order_item_id: string }).order_item_id, { vendor_id: (a as { vendor_id: string }).vendor_id })
        }
    }
    const vendorIds = [...new Set([...allocationsByItemId.values()].map((v) => v.vendor_id))]
    if (order.vendor_id) vendorIds.push(order.vendor_id)
    let vendorsMap = new Map<string, { business_name: string; city?: string }>()
    if (vendorIds.length > 0) {
        const { data: vendors } = await supabase
            .from('vendors')
            .select('id, business_name, city')
            .in('id', vendorIds)
        for (const v of vendors ?? []) {
            vendorsMap.set((v as { id: string }).id, {
                business_name: (v as { business_name: string }).business_name,
                city: (v as { city?: string }).city,
            })
        }
    }
    const itemsWithAllocation = (items ?? []).map((i: { id: string }) => {
        const alloc = allocationsByItemId.get(i.id)
        return {
            ...i,
            allocated_vendor_id: alloc?.vendor_id ?? null,
            allocated_vendor_name: alloc ? vendorsMap.get(alloc.vendor_id)?.business_name ?? null : null,
            allocated_vendor_city: alloc ? vendorsMap.get(alloc.vendor_id)?.city ?? null : null,
        }
    })

    const { data: history } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true })

    return NextResponse.json({
        ...order,
        items: itemsWithAllocation,
        status_history: history ?? [],
    })
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const body = await req.json()
    const { status, note, vendor_id } = body

    const updatePayload: Record<string, unknown> = {}
    if (status != null) updatePayload.status = status
    if (vendor_id !== undefined) {
        updatePayload.vendor_id = vendor_id || null
        if (vendor_id === null || vendor_id === '') {
            const { data: oi } = await supabase.from('order_items').select('id').eq('order_id', id)
            const oiIds = (oi ?? []).map((x: { id: string }) => x.id)
            if (oiIds.length > 0) {
                await supabase.from('order_item_allocations').delete().in('order_item_id', oiIds)
            }
        }
    }

    if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ error: 'status or vendor_id required' }, { status: 400 })
    }

    const { data: currentOrder } = await supabase
        .from('orders')
        .select('vendor_id, status, contact_name, event_date')
        .eq('id', id)
        .single()

    const { data: order, error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    if (status != null) {
        const { error: historyError } = await supabase.from('order_status_history').insert([
            { order_id: id, status, note: note ?? `Status updated to ${status}` },
        ])
        if (historyError) {
            console.error('Failed to insert order status history:', historyError.message)
        }
    }

    const contactName = currentOrder?.contact_name || 'customer'

    if (status != null && currentOrder?.vendor_id && status !== currentOrder.status) {
        const statusMessages: Record<string, { title: string; message: string }> = {
            confirmed: { title: 'Order Confirmed', message: `Order for ${contactName} has been confirmed.` },
            cancelled: { title: 'Order Cancelled', message: `Order for ${contactName} has been cancelled.` },
            completed: { title: 'Order Completed', message: `Order for ${contactName} has been marked as completed.` },
            pending: { title: 'Order Status Updated', message: `Order for ${contactName} status has been updated to pending.` },
            in_progress: { title: 'Order In Progress', message: `Order for ${contactName} is now in progress.` },
        }
        const statusInfo = statusMessages[status] ?? { title: 'Order Updated', message: `Order for ${contactName} has been updated.` }
        try {
            await sendNotificationToVendor({
                vendor_id: currentOrder.vendor_id,
                type: 'booking_update',
                title: statusInfo.title,
                message: statusInfo.message,
                data: { order_id: id, status, previous_status: currentOrder.status },
            })
        } catch (notifErr) {
            console.error('Failed to send vendor notification:', notifErr)
        }
    }

    if (vendor_id && !currentOrder?.vendor_id) {
        try {
            await sendNotificationToVendor({
                vendor_id: vendor_id as string,
                type: 'booking_update',
                title: 'New Order Assigned',
                message: `A new order has been assigned to you for ${contactName}.`,
                data: { order_id: id, event_date: currentOrder?.event_date },
            })
        } catch (notifErr) {
            console.error('Failed to send assignment notification:', notifErr)
        }
    }

    return NextResponse.json(order)
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    }

    // Remove related data first to avoid FK issues.
    const { data: orderItems } = await supabase.from('order_items').select('id').eq('order_id', id)
    const itemIds = (orderItems ?? []).map((i: { id: string }) => i.id)
    if (itemIds.length > 0) {
        const { error: allocErr } = await supabase.from('order_item_allocations').delete().in('order_item_id', itemIds)
        if (allocErr) {
            return NextResponse.json({ error: 'Failed to delete item allocations: ' + allocErr.message }, { status: 500 })
        }
    }
    const { error: quotErr } = await supabase.from('quotations').delete().eq('order_id', id)
    if (quotErr) {
        return NextResponse.json({ error: 'Failed to delete quotations: ' + quotErr.message }, { status: 500 })
    }
    const { error: histErr } = await supabase.from('order_status_history').delete().eq('order_id', id)
    if (histErr) {
        return NextResponse.json({ error: 'Failed to delete status history: ' + histErr.message }, { status: 500 })
    }
    const { error: oiErr } = await supabase.from('order_items').delete().eq('order_id', id)
    if (oiErr) {
        return NextResponse.json({ error: 'Failed to delete order items: ' + oiErr.message }, { status: 500 })
    }

    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
}
