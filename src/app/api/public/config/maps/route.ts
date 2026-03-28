import { NextResponse } from 'next/server'

/**
 * GET /api/public/config/maps
 * Returns the browser Maps JavaScript API key for map picker UIs (restrict key by HTTP referrer in Google Cloud).
 */
export async function GET() {
    const googleMapsApiKey =
        process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ''
    return NextResponse.json({ googleMapsApiKey })
}
