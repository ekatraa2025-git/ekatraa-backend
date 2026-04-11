import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase/server'

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim()
}

function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[[^\]]+\]$/.test(token)
}

export async function POST(req: Request) {
  const { userId, error: authError } = await getEndUserIdFromRequest(req)
  if (authError) return authError

  const body = await req.json().catch(() => ({}))
  const token = normalizeToken(body?.expo_push_token)
  const platform = typeof body?.platform === 'string' ? body.platform.trim().slice(0, 30) : null
  const appId = typeof body?.app_id === 'string' ? body.app_id.trim().slice(0, 120) : 'ekatraa-user-app'

  if (!token || !isExpoPushToken(token)) {
    return NextResponse.json({ error: 'Valid expo_push_token is required.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('user_push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform,
      app_id: appId,
      is_active: true,
      last_seen_at: now,
      updated_at: now,
      disabled_at: null,
      disabled_reason: null,
      last_error_code: null,
      last_error_message: null,
      last_receipt_id: null,
    },
    { onConflict: 'expo_push_token' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { userId, error: authError } = await getEndUserIdFromRequest(req)
  if (authError) return authError

  const body = await req.json().catch(() => ({}))
  const token = normalizeToken(body?.expo_push_token)
  if (!token) {
    return NextResponse.json({ error: 'expo_push_token is required.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('user_push_tokens')
    .update({
      is_active: false,
      updated_at: now,
      disabled_at: now,
      disabled_reason: 'manual_logout',
      last_error_code: 'manual_logout',
      last_error_message: 'Token disabled by user logout.',
    })
    .eq('user_id', userId)
    .eq('expo_push_token', token)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
