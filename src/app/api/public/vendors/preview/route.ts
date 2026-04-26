import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorsPreviewCore } from '@/lib/vendors-preview-core'

/**
 * GET /api/public/vendors/preview?city=&occasion_id=&limit=
 * Redacted vendor cards for discovery (no phone/email; full detail after advance payment in-app).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city')
    const occasionId = searchParams.get('occasion_id')
    const limit = parseInt(searchParams.get('limit') || '12', 10)

    const result = await getVendorsPreviewCore(supabase, {
        city,
        occasionId,
        limit,
    })

    if (!result.ok) {
        return NextResponse.json({ error: result.message }, { status: 500 })
    }

    return NextResponse.json(result.data)
}
