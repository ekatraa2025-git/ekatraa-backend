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

export async function GET(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('vendor_id', auth.vendorId)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(Array.isArray(data) ? data : [])
}

export async function POST(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    try {
        const payload = await req.json()
        const body = sanitizeServicePayload((payload || {}) as Record<string, unknown>, auth.vendorId)
        const { data, error } = await supabase.from('services').insert([body]).select().single()
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json(data, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    try {
        const body = await req.json().catch(() => ({}))
        const ids = Array.isArray(body?.ids)
            ? body.ids.map((id: unknown) => String(id || '').trim()).filter(Boolean)
            : []
        if (!ids.length) {
            return NextResponse.json({ error: 'ids[] is required.' }, { status: 400 })
        }

        const { error } = await supabase
            .from('services')
            .delete()
            .eq('vendor_id', auth.vendorId)
            .in('id', ids)
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ ok: true })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
    }
}
