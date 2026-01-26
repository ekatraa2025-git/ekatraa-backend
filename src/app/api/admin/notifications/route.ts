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
          created_at: new Date().toISOString(),
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

    // Map vendor IDs to auth user IDs
    // Check if vendors table has user_id field, otherwise assume vendors.id = auth.users.id
    const { data: vendorsData, error: vendorsError } = await supabase
      .from('vendors')
      .select('id, user_id')
      .in('id', vendor_ids)

    let mappedVendorIds = vendor_ids

    if (!vendorsError && vendorsData) {
      // If vendors have user_id field, use it; otherwise use vendors.id
      mappedVendorIds = vendorsData.map((vendor: any) => vendor.user_id || vendor.id)
      console.log('[Notifications] Mapped vendor IDs:', {
        original: vendor_ids,
        mapped: mappedVendorIds,
        vendors: vendorsData
      })
    } else {
      console.log('[Notifications] Using vendor IDs as-is (assuming vendors.id = auth.users.id):', vendor_ids)
    }

    const currentTimestamp = new Date().toISOString();
    const notifications = mappedVendorIds.map((vendor_id) => ({
      vendor_id,
      type,
      title,
      message,
      data: data || {},
      read: false,
      created_at: currentTimestamp,
    }))

    console.log('[Notifications] Inserting notifications:', notifications)

    const { data: insertedNotifications, error } = await supabase
      .from('vendor_notifications')
      .insert(notifications)
      .select()

    if (error) {
      console.error('[Notifications] Error inserting notifications:', error)
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

    console.log('[Notifications] Successfully inserted notifications:', insertedNotifications)

    return NextResponse.json({
      success: true,
      count: insertedNotifications?.length || 0,
      notifications: insertedNotifications,
    })
  } catch (error: any) {
    console.error('[Notifications] Exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
