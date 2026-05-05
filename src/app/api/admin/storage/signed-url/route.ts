import { supabase } from '@/lib/supabase/server'
import { storageSignedUrlTtlSeconds } from '@/lib/storage-display-url'
import { NextResponse } from 'next/server'

const BUCKET_NAME = 'ekatraa2025'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')

    if (!path || typeof path !== 'string' || path.trim() === '') {
        return NextResponse.json({ error: 'Missing or invalid path' }, { status: 400 })
    }

    const trimmedPath = path.trim()
    if (trimmedPath.startsWith('http')) {
        return NextResponse.json({ url: trimmedPath }, { status: 200 })
    }

    try {
        const expiresIn = storageSignedUrlTtlSeconds(trimmedPath)
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(trimmedPath, expiresIn)

        if (error) {
            console.error('Signed URL error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!data?.signedUrl) {
            return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
        }

        return NextResponse.json({ url: data.signedUrl })
    } catch (err: any) {
        console.error('Signed URL error:', err)
        return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
    }
}
