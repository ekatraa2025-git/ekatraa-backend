import { NextResponse } from 'next/server'

/**
 * Expose the RSA public key for encrypting admin login payloads.
 * When unset, clients send plaintext JSON (local dev only — use HTTPS + keys in production).
 */
export async function GET() {
    const publicKey = process.env.ADMIN_LOGIN_RSA_PUBLIC_KEY?.trim()
    if (!publicKey) {
        return new NextResponse(null, { status: 204 })
    }
    return NextResponse.json({ publicKey })
}
