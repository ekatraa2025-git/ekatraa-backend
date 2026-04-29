import { supabase } from '@/lib/supabase/server'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/occasions
 * Returns canonical occasions for the new flow (from occasions table).
 */
export async function GET() {
    const { data, error } = await supabase
        .from('occasions')
        .select('id, name, image_url, icon_url, icon, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = Array.isArray(data) ? data : []
    const withSignedImages = await Promise.all(
        rows.map(async (row: { image_url?: string | null; [k: string]: unknown }) => {
            const signed = await signedUrlForStorageRef(row.image_url ?? null)
            return { ...row, image_url: signed ?? row.image_url ?? null }
        })
    )

    return NextResponse.json(withSignedImages)
}
