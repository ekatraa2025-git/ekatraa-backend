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

    const { data: history } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true })

    return NextResponse.json({
        ...order,
        items: items ?? [],
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
    if (vendor_id !== undefined) updatePayload.vendor_id = vendor_id || null

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
        await supabase.from('order_status_history').insert([
            { order_id: id, status, note: note ?? `Status updated to ${status}` },
        ])
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
        await sendNotificationToVendor({
            vendor_id: currentOrder.vendor_id,
            type: 'booking_update',
            title: statusInfo.title,
            message: statusInfo.message,
            data: { order_id: id, status, previous_status: currentOrder.status },
        })
    }

    if (vendor_id && !currentOrder?.vendor_id) {
        await sendNotificationToVendor({
            vendor_id: vendor_id as string,
            type: 'booking_update',
            title: 'New Order Assigned',
            message: `A new order has been assigned to you for ${contactName}.`,
            data: { order_id: id, event_date: currentOrder?.event_date },
        })
    }

    return NextResponse.json(order)
}
