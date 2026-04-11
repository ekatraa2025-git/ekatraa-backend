import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'

function maskToken(token: string | null | undefined): string {
  const raw = String(token || '')
  if (!raw) return ''
  if (raw.length <= 14) return raw
  return `${raw.slice(0, 10)}…${raw.slice(-6)}`
}

function parseBool(value: string | null, fallback = false): boolean {
  if (value == null) return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export async function GET(req: Request) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const includeDisabled = parseBool(searchParams.get('include_disabled'), true)
  const actorId = searchParams.get('actor_id')?.trim() || null
  const limitRaw = Number(searchParams.get('limit') || 30)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 30

  let userCountQuery = supabase.from('user_push_tokens').select('*', { count: 'exact', head: true })
  let userActiveQuery = supabase.from('user_push_tokens').select('*', { count: 'exact', head: true }).eq('is_active', true)
  let vendorCountQuery = supabase.from('vendor_push_tokens').select('*', { count: 'exact', head: true })
  let vendorActiveQuery = supabase.from('vendor_push_tokens').select('*', { count: 'exact', head: true }).eq('is_active', true)
  let userRowsQuery = supabase
    .from('user_push_tokens')
    .select('id, user_id, expo_push_token, platform, app_id, is_active, disabled_reason, disabled_at, last_error_code, last_error_message, last_receipt_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)
  let vendorRowsQuery = supabase
    .from('vendor_push_tokens')
    .select('id, vendor_id, expo_push_token, platform, app_id, is_active, disabled_reason, disabled_at, last_error_code, last_error_message, last_receipt_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (actorId) {
    userCountQuery = userCountQuery.eq('user_id', actorId)
    userActiveQuery = userActiveQuery.eq('user_id', actorId)
    vendorCountQuery = vendorCountQuery.eq('vendor_id', actorId)
    vendorActiveQuery = vendorActiveQuery.eq('vendor_id', actorId)
    userRowsQuery = userRowsQuery.eq('user_id', actorId)
    vendorRowsQuery = vendorRowsQuery.eq('vendor_id', actorId)
  }

  const [userCountRes, userActiveRes, vendorCountRes, vendorActiveRes, userRowsRes, vendorRowsRes] =
    await Promise.all([
      userCountQuery,
      userActiveQuery,
      vendorCountQuery,
      vendorActiveQuery,
      userRowsQuery,
      vendorRowsQuery,
    ])

  const firstError =
    userCountRes.error ||
    userActiveRes.error ||
    vendorCountRes.error ||
    vendorActiveRes.error ||
    userRowsRes.error ||
    vendorRowsRes.error

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 })
  }

  const normalizeRows = (rows: Array<Record<string, unknown>> = [], actorKey: 'user_id' | 'vendor_id') => {
    const filtered = includeDisabled ? rows : rows.filter((row) => row.is_active === true)
    return filtered.map((row) => ({
      id: row.id,
      actor_id: row[actorKey],
      token_masked: maskToken(String(row.expo_push_token || '')),
      platform: row.platform ?? null,
      app_id: row.app_id ?? null,
      is_active: row.is_active === true,
      disabled_reason: row.disabled_reason ?? null,
      disabled_at: row.disabled_at ?? null,
      last_error_code: row.last_error_code ?? null,
      last_error_message: row.last_error_message ?? null,
      last_receipt_id: row.last_receipt_id ?? null,
      updated_at: row.updated_at ?? null,
    }))
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    include_disabled: includeDisabled,
    actor_id_filter: actorId,
    summary: {
      user_tokens: {
        total: userCountRes.count ?? 0,
        active: userActiveRes.count ?? 0,
        disabled: Math.max((userCountRes.count ?? 0) - (userActiveRes.count ?? 0), 0),
      },
      vendor_tokens: {
        total: vendorCountRes.count ?? 0,
        active: vendorActiveRes.count ?? 0,
        disabled: Math.max((vendorCountRes.count ?? 0) - (vendorActiveRes.count ?? 0), 0),
      },
    },
    recent: {
      users: normalizeRows((userRowsRes.data || []) as Array<Record<string, unknown>>, 'user_id'),
      vendors: normalizeRows((vendorRowsRes.data || []) as Array<Record<string, unknown>>, 'vendor_id'),
    },
  })
}
