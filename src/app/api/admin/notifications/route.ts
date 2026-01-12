import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface NotificationPayload {
  vendor_id: string
  type: 'booking_update' | 'system_update' | 'quotation' | 'general'
  title: string
  message: string
  data?: any
}

// Send notification to a vendor
export async function POST(req: Request) {
  try {
    const body: NotificationPayload = await req.json()
    const { vendor_id, type, title, message, data } = body

    if (!vendor_id || !type || !title || !message) {
      return NextResponse.json(
        { error: 'vendor_id, type, title, and message are required' },
        { status: 400 }
      )
    }

    const { data: notification, error } = await supabase
      .from('vendor_notifications')
      .insert([
        {
          vendor_id,
          type,
          title,
          message,
          data: data || {},
          read: false,
        },
      ])
      .select()
      .single()

    if (error) {
      // If table doesn't exist, log error but don't fail
      if (error.code === '42P01') {
        console.warn('vendor_notifications table does not exist. Please create it in Supabase.')
        return NextResponse.json({
          success: true,
          message: 'Notification would be sent (table not found)',
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(notification, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Send notification to multiple vendors
export async function PUT(req: Request) {
  try {
    const body: { vendor_ids: string[] } & Omit<NotificationPayload, 'vendor_id'> = await req.json()
    const { vendor_ids, type, title, message, data } = body

    if (!vendor_ids || !Array.isArray(vendor_ids) || vendor_ids.length === 0) {
      return NextResponse.json(
        { error: 'vendor_ids array is required' },
        { status: 400 }
      )
    }

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'type, title, and message are required' },
        { status: 400 }
      )
    }

    const notifications = vendor_ids.map((vendor_id) => ({
      vendor_id,
      type,
      title,
      message,
      data: data || {},
      read: false,
    }))

    const { data: insertedNotifications, error } = await supabase
      .from('vendor_notifications')
      .insert(notifications)
      .select()

    if (error) {
      // If table doesn't exist, log error but don't fail
      if (error.code === '42P01') {
        console.warn('vendor_notifications table does not exist. Please create it in Supabase.')
        return NextResponse.json({
          success: true,
          message: 'Notifications would be sent (table not found)',
          count: vendor_ids.length,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: insertedNotifications?.length || 0,
      notifications: insertedNotifications,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
