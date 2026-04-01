import { supabase } from './supabase/server'

export interface NotificationPayload {
  vendor_id: string
  type: 'booking_update' | 'system_update' | 'quotation' | 'general'
  title: string
  message: string
  data?: any
}

async function fetchUserIdsTouchingVendor(vendorId: string): Promise<string[]> {
  const ids = new Set<string>()
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('user_id')
      .eq('vendor_id', vendorId)
    orders?.forEach((r: { user_id?: string | null }) => {
      if (r.user_id) ids.add(r.user_id)
    })
  } catch {
    /* optional table shape */
  }
  try {
    const { data: enquiries } = await supabase
      .from('enquiries')
      .select('user_id')
      .eq('vendor_id', vendorId)
    enquiries?.forEach((r: { user_id?: string | null }) => {
      if (r.user_id) ids.add(r.user_id)
    })
  } catch {
    /* optional */
  }
  return [...ids]
}

/**
 * When a vendor becomes active: notify vendor, admins, and end-users who interacted with this vendor.
 */
export async function notifyVendorActivated(
  vendorId: string,
  businessName: string
): Promise<void> {
  const title = 'Vendor is now live'
  const message = `${businessName || 'A vendor'} is now active on Ekatraa.`
  const data = { vendor_id: vendorId, kind: 'vendor_activated' }

  await sendNotificationToVendor({
    vendor_id: vendorId,
    type: 'system_update',
    title,
    message,
    data: { ...data, activation: true },
  })

  try {
    await supabase.from('admin_notifications').insert({
      type: 'vendor_activated',
      title,
      message,
      data,
      read: false,
    })
  } catch (e) {
    console.warn('admin_notifications insert skipped:', e)
  }

  const userIds = await fetchUserIdsTouchingVendor(vendorId)
  if (userIds.length === 0) return

  const rows = userIds.map((user_id) => ({
    user_id,
    type: 'vendor_activated',
    title,
    message,
    data,
    read: false,
  }))

  try {
    const { error } = await supabase.from('user_notifications').insert(rows)
    if (error) console.warn('user_notifications insert:', error.message)
  } catch (e) {
    console.warn('user_notifications insert skipped:', e)
  }
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
