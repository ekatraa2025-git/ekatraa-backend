import { getSandboxAccessToken } from '@/lib/sandbox-auth'

/**
 * Authenticated POST to Sandbox API — same header pattern as
 * {@link src/app/api/kyc/aadhaar/generate-otp/route.ts}:
 * Authorization = raw JWT (no Bearer), x-api-key, x-api-version.
 */
export async function sandboxAuthorizedPost(pathOrAbsoluteUrl: string, body: unknown): Promise<Response> {
    const SANDBOX_HOST = process.env.SANDBOX_HOST || 'https://api.sandbox.co.in'
    const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY
    if (!SANDBOX_API_KEY) {
        throw new Error('SANDBOX_API_KEY not configured')
    }

    const accessToken = await getSandboxAccessToken()
    const url = pathOrAbsoluteUrl.startsWith('http')
        ? pathOrAbsoluteUrl
        : `${SANDBOX_HOST.replace(/\/+$/, '')}${pathOrAbsoluteUrl.startsWith('/') ? pathOrAbsoluteUrl : `/${pathOrAbsoluteUrl}`}`

    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: accessToken,
            'x-api-key': SANDBOX_API_KEY,
            'x-api-version': process.env.SANDBOX_API_VERSION?.trim() || '1.0.0',
        },
        body: JSON.stringify(body),
    })
}
