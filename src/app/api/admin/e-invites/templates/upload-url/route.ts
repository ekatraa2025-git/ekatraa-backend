import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/require-admin-session'

const BUCKET_NAME = 'ekatraa2025'

function sanitizeSegment(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9-_./]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export async function POST(req: Request) {
    const auth = await requireAdminSession()
    if (!auth.ok) return auth.response

    try {
        const body = await req.json()
        const rawFilename = String(body.filename || '').trim()
        if (!rawFilename) {
            return NextResponse.json({ error: 'filename is required' }, { status: 400 })
        }

        const section = sanitizeSegment(String(body.section_key || 'general')) || 'general'
        const filename = sanitizeSegment(rawFilename) || `file-${Date.now()}`
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const path = `e-invites/${section}/${timestamp}-${filename}`

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUploadUrl(path)

        if (error || !data) {
            return NextResponse.json({ error: error?.message || 'Could not create upload URL' }, { status: 500 })
        }

        return NextResponse.json({
            bucket: BUCKET_NAME,
            path,
            token: data.token,
            signed_url: data.signedUrl,
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
