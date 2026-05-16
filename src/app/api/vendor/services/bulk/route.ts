import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

function sanitizeServicePayload(raw: Record<string, unknown>, vendorId: string): Record<string, unknown> {
    const body = { ...raw }
    delete body.id
    delete body.created_at
    delete body.updated_at
    delete body.vendor
    body.vendor_id = vendorId
    return body
}

export async function POST(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    try {
        const body = await req.json().catch(() => ({}))
        const rows = Array.isArray(body?.rows)
            ? body.rows
                .filter((row: unknown) => row && typeof row === 'object')
                .map((row: unknown) => sanitizeServicePayload(row as Record<string, unknown>, auth.vendorId))
            : []

        if (!rows.length) {
            return NextResponse.json({ error: 'rows[] is required.' }, { status: 400 })
        }

        const { data, error } = await supabase.from('services').insert(rows).select('*')
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ ok: true, count: Array.isArray(data) ? data.length : 0, rows: data || [] })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
    }
}
