import { supabase } from './supabase/server'

export interface NotificationPayload {
  vendor_id: string
  type: 'booking_update' | 'system_update' | 'quotation' | 'general'
  title: string
  message: string
  data?: any
}

/**
 * Send a notification to a vendor
 * This function can be called from anywhere in the backend
 */
export async function sendNotificationToVendor(payload: NotificationPayload): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('vendor_notifications')
      .insert([
        {
          vendor_id: payload.vendor_id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          data: payload.data || {},
          read: false,
        },
      ])

    if (error) {
      console.error('Failed to send notification:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending notification:', error)
    return false
  }
}

/**
 * Send notifications to multiple vendors
 */
export async function sendNotificationToVendors(
  vendorIds: string[],
  type: NotificationPayload['type'],
  title: string,
  message: string,
  data?: any
): Promise<number> {
  if (!vendorIds || vendorIds.length === 0) return 0

  const notifications = vendorIds.map((vendor_id) => ({
    vendor_id,
    type,
    title,
    message,
    data: data || {},
    read: false,
  }))

  try {
    const { data, error } = await supabase
      .from('vendor_notifications')
      .insert(notifications)
      .select()

    if (error) {
      console.error('Failed to send notifications:', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.error('Error sending notifications:', error)
    return 0
  }
}

/**
 * Send system update notification to all vendors
 */
export async function sendSystemUpdateToAllVendors(
  title: string,
  message: string,
  data?: any
): Promise<number> {
  try {
    // Get all vendor IDs
    const { data: vendors, error: vendorError } = await supabase
      .from('vendors')
      .select('id')

    if (vendorError || !vendors || vendors.length === 0) {
      console.error('Failed to fetch vendors:', vendorError)
      return 0
    }

    const vendorIds = vendors.map((v) => v.id)
    return await sendNotificationToVendors(
      vendorIds,
      'system_update',
      title,
      message,
      data
    )
  } catch (error) {
    console.error('Error sending system update:', error)
    return 0
  }
}
