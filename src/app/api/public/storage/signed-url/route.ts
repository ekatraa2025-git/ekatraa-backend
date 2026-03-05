import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const BUCKET_NAME = 'ekatraa2025'
const DEFAULT_EXPIRES_IN = 3600

/**
 * GET /api/public/storage/signed-url?path=folder/file.ext
 * Returns a signed URL for a storage path using the service role key.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')

    if (!path || typeof path !== 'string' || path.trim() === '') {
        return NextResponse.json({ error: 'Missing or invalid path' }, { status: 400 })
    }

    const trimmedPath = path.trim()

    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(trimmedPath, DEFAULT_EXPIRES_IN)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!data?.signedUrl) {
            return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
        }

        return NextResponse.json({ url: data.signedUrl })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
    }
}
