import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNotificationToVendor } from '@/lib/notifications'

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { data: booking, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(booking)
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await req.json()
        
        // Get current booking to check for status changes
        const { data: currentBooking } = await supabase
            .from('bookings')
            .select('vendor_id, status, customer_name, booking_date')
            .eq('id', id)
            .single()

        const { data, error } = await supabase
            .from('bookings')
            .update(body)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        // Send notification if status changed and vendor is assigned
        if (body.status && currentBooking?.vendor_id && body.status !== currentBooking.status) {
            const statusMessages: Record<string, { title: string; message: string }> = {
                confirmed: {
                    title: 'Booking Confirmed',
                    message: `Booking for ${currentBooking.customer_name || 'customer'} has been confirmed.`,
                },
                cancelled: {
                    title: 'Booking Cancelled',
                    message: `Booking for ${currentBooking.customer_name || 'customer'} has been cancelled.`,
                },
                completed: {
                    title: 'Booking Completed',
                    message: `Booking for ${currentBooking.customer_name || 'customer'} has been marked as completed.`,
                },
                pending: {
                    title: 'Booking Status Updated',
                    message: `Booking for ${currentBooking.customer_name || 'customer'} status has been updated to pending.`,
                },
            }

            const statusInfo = statusMessages[body.status] || {
                title: 'Booking Updated',
                message: `Booking for ${currentBooking.customer_name || 'customer'} has been updated.`,
            }

            await sendNotificationToVendor({
                vendor_id: currentBooking.vendor_id,
                type: 'booking_update',
                title: statusInfo.title,
                message: statusInfo.message,
                data: {
                    booking_id: id,
                    status: body.status,
                    previous_status: currentBooking.status,
                },
            })
        }

        // Send notification if vendor is assigned for the first time
        if (body.vendor_id && !currentBooking?.vendor_id) {
            await sendNotificationToVendor({
                vendor_id: body.vendor_id,
                type: 'booking_update',
                title: 'New Booking Assigned',
                message: `A new booking has been assigned to you for ${currentBooking?.customer_name || 'a customer'}.`,
                data: {
                    booking_id: id,
                    booking_date: currentBooking?.booking_date,
                },
            })
        }

        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
}
