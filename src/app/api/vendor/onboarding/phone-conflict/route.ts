import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/server'

function normalizePhoneDigits(raw: string): string {
    return String(raw || '').replace(/\D/g, '').slice(-10)
}

function phoneLookupVariants(raw: string): string[] {
    const digits = normalizePhoneDigits(raw)
    if (digits.length !== 10) return []
    return [`+91${digits}`, digits, `91${digits}`]
}

type RequestBody = {
    phone?: string
    exclude_vendor_id?: string | null
}

export async function POST(req: Request) {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '') ?? ''
    if (!token) {
        return NextResponse.json({ error: 'Authorization required. Pass Bearer token.' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json({ error: 'Server auth configuration missing' }, { status: 500 })
    }

    const anon = createClient(supabaseUrl, supabaseAnonKey)
    const {
        data: { user },
        error: userError,
    } = await anon.auth.getUser(token)
    if (userError || !user?.id) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody
    const variants = phoneLookupVariants(String(body.phone || ''))
    if (!variants.length) {
        return NextResponse.json({ error: 'Please enter a valid 10-digit business mobile number.' }, { status: 400 })
    }

    const excludeVendorId = String(body.exclude_vendor_id || '').trim() || null
    const { data, error } = await supabase.from('vendors').select('id, phone').in('phone', variants).limit(10)
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = Array.isArray(data) ? data : []
    const conflictRow = rows.find((row) => String(row.id || '') !== excludeVendorId)

    return NextResponse.json({
        conflict: !!conflictRow,
        conflict_vendor_id: conflictRow ? String(conflictRow.id) : null,
    })
}
