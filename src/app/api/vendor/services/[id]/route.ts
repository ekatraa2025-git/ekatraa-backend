import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

function sanitizeServicePatch(raw: Record<string, unknown>): Record<string, unknown> {
    const body = { ...raw }
    delete body.id
    delete body.vendor_id
    delete body.created_at
    delete body.updated_at
    delete body.vendor
    return body
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Service id is required.' }, { status: 400 })

    try {
        const payload = await req.json()
        const body = sanitizeServicePatch((payload || {}) as Record<string, unknown>)
        const { data, error } = await supabase
            .from('services')
            .update(body)
            .eq('id', id)
            .eq('vendor_id', auth.vendorId)
            .select()
            .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Service id is required.' }, { status: 400 })

    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)
        .eq('vendor_id', auth.vendorId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
}
