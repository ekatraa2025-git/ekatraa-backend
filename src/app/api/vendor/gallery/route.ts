import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'

export async function PATCH(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const body = await req.json().catch(() => ({}))
    const galleryUrls = Array.isArray(body?.gallery_urls)
        ? body.gallery_urls.map((v: unknown) => String(v || '').trim()).filter(Boolean).slice(0, 12)
        : null

    if (!galleryUrls) {
        return NextResponse.json({ error: 'gallery_urls[] is required.' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('vendors')
        .update({ gallery_urls: galleryUrls })
        .eq('id', auth.vendorId)
        .select('id, gallery_urls')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, vendor: data })
}
