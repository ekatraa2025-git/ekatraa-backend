import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

const BUCKET = 'ekatraa2025'

function mimeToExtension(mimeType: string): string {
    const normalized = mimeType.toLowerCase()
    if (normalized.includes('png')) return 'png'
    if (normalized.includes('webp')) return 'webp'
    if (normalized.includes('heic')) return 'heic'
    if (normalized.includes('gif')) return 'gif'
    return 'jpg'
}

export async function POST(req: Request) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    try {
        const body = await req.json().catch(() => ({}))
        const base64 = String(body?.base64 || '').trim()
        const mimeType = String(body?.mime_type || body?.mimeType || 'image/jpeg').trim()
        const prefix = String(body?.prefix || 'image').trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'image'

        if (!base64) {
            return NextResponse.json({ error: 'base64 is required.' }, { status: 400 })
        }

        const decoded = Buffer.from(base64, 'base64')
        if (!decoded.length) {
            return NextResponse.json({ error: 'Invalid base64 payload.' }, { status: 400 })
        }
        if (decoded.length > 15 * 1024 * 1024) {
            return NextResponse.json({ error: 'File exceeds 15MB limit.' }, { status: 413 })
        }

        const ext = mimeToExtension(mimeType)
        const path = `vendor/${auth.vendorId}/${prefix}-${Date.now()}-${randomUUID()}.${ext}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, decoded, {
            contentType: mimeType,
            upsert: false,
        })
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        const signedUrl = await signedUrlForStorageRef(path)
        return NextResponse.json({
            ok: true,
            path,
            signed_url: signedUrl,
        })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
    }
}
