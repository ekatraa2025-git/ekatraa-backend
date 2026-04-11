import { supabase } from './supabase/server'

export interface NotificationPayload {
  vendor_id: string
  type: 'booking_update' | 'system_update' | 'quotation' | 'general'
  title: string
  message: string
  data?: any
}

interface ExpoPushMessage {
  to: string
  sound?: 'default'
  title: string
  body: string
  data?: Record<string, unknown>
}

type PushTokenTable = 'user_push_tokens' | 'vendor_push_tokens'
type TokenDisableRecord = {
  token: string
  reason: string
  receiptId?: string | null
  message?: string | null
}

function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[[^\]]+\]$/.test(String(token || '').trim())
}

function chunkArray<T>(rows: T[], size: number): T[][]
{
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size))
  return chunks
}

async function deactivatePushTokens(table: PushTokenTable, records: TokenDisableRecord[]): Promise<void> {
  if (!records.length) return
  const byToken = new Map<string, TokenDisableRecord>()
  records.forEach((r) => {
    const token = String(r.token || '').trim()
    if (!token) return
    byToken.set(token, { ...r, token })
  })
  if (!byToken.size) return
  const now = new Date().toISOString()
  for (const row of byToken.values()) {
    const { error } = await supabase
      .from(table)
      .update({
        is_active: false,
        updated_at: now,
        disabled_at: now,
        disabled_reason: row.reason || 'unknown_error',
        last_error_code: row.reason || 'unknown_error',
        last_error_message: row.message ?? null,
        last_receipt_id: row.receiptId ?? null,
      })
      .eq('expo_push_token', row.token)
    if (error) {
      console.warn(`${table} deactivate failed:`, error.message)
    }
  }
}

function shouldDisableTokenFromExpoError(err: string): boolean {
  const normalized = String(err || '')
  return (
    normalized.includes('DeviceNotRegistered') ||
    normalized.includes('PushTokenNotRegistered')
  )
}

async function sendExpoPushMessages(messages: ExpoPushMessage[], tokenTable: PushTokenTable): Promise<void> {
  if (!messages.length) return
  const ticketToToken = new Map<string, string>()
  const immediateInvalidTokens: TokenDisableRecord[] = []

  for (const batch of chunkArray(messages, 100)) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      console.warn('Expo push send failed', payload || response.statusText)
      continue
    }

      const rows = Array.isArray(payload?.data) ? payload.data : []
      rows.forEach((ticket: { status?: string; id?: string; details?: { error?: string } }, idx: number) => {
        const token = batch[idx]?.to
        if (!token) return
        if (ticket?.status === 'ok' && ticket.id) {
          ticketToToken.set(ticket.id, token)
          return
        }
        const err = ticket?.details?.error
        if (err && shouldDisableTokenFromExpoError(err)) {
          immediateInvalidTokens.push({
            token,
            reason: err,
            message: `Expo ticket error: ${err}`,
          })
        }
      })
      const errors = rows.filter((entry: { status?: string }) => entry?.status === 'error')
      if (errors.length > 0) {
        console.warn('Expo push partial failures', errors)
      }
    } catch (e) {
      console.warn('Expo push request error', e)
    }
  }

  if (immediateInvalidTokens.length) {
    await deactivatePushTokens(tokenTable, immediateInvalidTokens)
  }

  const receiptIds = [...ticketToToken.keys()]
  if (!receiptIds.length) return
  const receiptInvalidTokens: TokenDisableRecord[] = []
  for (const ids of chunkArray(receiptIds, 300)) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        console.warn('Expo push receipts failed', payload || response.statusText)
        continue
      }
      const receiptMap = payload?.data && typeof payload.data === 'object' ? payload.data : {}
      ids.forEach((id) => {
        const receipt = receiptMap[id]
        if (!receipt || receipt.status !== 'error') return
        const err = receipt?.details?.error
        if (err && shouldDisableTokenFromExpoError(err)) {
          const token = ticketToToken.get(id)
          if (token) {
            receiptInvalidTokens.push({
              token,
              reason: err,
              receiptId: id,
              message: `Expo receipt error: ${err}`,
            })
          }
        }
      })
    } catch (e) {
      console.warn('Expo push receipt request error', e)
    }
  }
  if (receiptInvalidTokens.length) {
    await deactivatePushTokens(tokenTable, receiptInvalidTokens)
  }
}

async function sendRemotePushToUser(params: {
  user_id: string
  title: string
  message: string
  data?: Record<string, unknown>
}): Promise<void> {
  if (!params.user_id) return
  const { data: tokens, error } = await supabase
    .from('user_push_tokens')
    .select('id, expo_push_token')
    .eq('user_id', params.user_id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) {
    console.warn('user_push_tokens fetch:', error.message)
    return
  }
  if (!tokens?.length) return

  const validRows = (tokens || []).filter((row: { expo_push_token?: string }) =>
    isExpoPushToken(String(row.expo_push_token || ''))
  )
  if (!validRows.length) return

  const messages: ExpoPushMessage[] = validRows.map((row: { expo_push_token: string }) => ({
    to: row.expo_push_token,
    sound: 'default',
    title: params.title,
    body: params.message,
    data: params.data ?? {},
  }))
  await sendExpoPushMessages(messages, 'user_push_tokens')
}

async function sendRemotePushToVendor(params: {
  vendor_id: string
  title: string
  message: string
  data?: Record<string, unknown>
}): Promise<void> {
  if (!params.vendor_id) return
  const { data: tokens, error } = await supabase
    .from('vendor_push_tokens')
    .select('id, expo_push_token')
    .eq('vendor_id', params.vendor_id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (error) {
    console.warn('vendor_push_tokens fetch:', error.message)
    return
  }
  if (!tokens?.length) return

  const validRows = (tokens || []).filter((row: { expo_push_token?: string }) =>
    isExpoPushToken(String(row.expo_push_token || ''))
  )
  if (!validRows.length) return

  const messages: ExpoPushMessage[] = validRows.map((row: { expo_push_token: string }) => ({
    to: row.expo_push_token,
    sound: 'default',
    title: params.title,
    body: params.message,
    data: params.data ?? {},
  }))
  await sendExpoPushMessages(messages, 'vendor_push_tokens')
}

async function sendRemotePushToVendors(params: {
  vendor_ids: string[]
  title: string
  message: string
  data?: Record<string, unknown>
}): Promise<void> {
  const vendorIds = [...new Set((params.vendor_ids || []).filter(Boolean))]
  if (!vendorIds.length) return
  const { data: tokens, error } = await supabase
    .from('vendor_push_tokens')
    .select('vendor_id, expo_push_token')
    .in('vendor_id', vendorIds)
    .eq('is_active', true)
    .limit(500)
  if (error) {
    console.warn('vendor_push_tokens bulk fetch:', error.message)
    return
  }
  if (!tokens?.length) return

  const messages: ExpoPushMessage[] = (tokens || [])
    .filter((row: { expo_push_token?: string }) => isExpoPushToken(String(row.expo_push_token || '')))
    .map((row: { vendor_id: string; expo_push_token: string }) => ({
      to: row.expo_push_token,
      sound: 'default',
      title: params.title,
      body: params.message,
      data: { ...(params.data ?? {}), vendor_id: row.vendor_id },
    }))
  if (!messages.length) return
  await sendExpoPushMessages(messages, 'vendor_push_tokens')
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
/**
 * In-app notification for end users (Supabase realtime).
 */
export async function sendNotificationToUser(params: {
  user_id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('user_notifications').insert([
      {
        user_id: params.user_id,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data ?? {},
        read: false,
      },
    ])
    if (error) {
      console.error('user_notifications insert:', error.message)
      return false
    }
    await sendRemotePushToUser({
      user_id: params.user_id,
      title: params.title,
      message: params.message,
      data: params.data ?? {},
    })
    return true
  } catch (e) {
    console.error('sendNotificationToUser:', e)
    return false
  }
}

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
    await sendRemotePushToVendor({
      vendor_id: payload.vendor_id,
      title: payload.title,
      message: payload.message,
      data: payload.data || {},
    })

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
    await sendRemotePushToVendors({
      vendor_ids: vendorIds,
      title,
      message,
      data: data || {},
    })

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
