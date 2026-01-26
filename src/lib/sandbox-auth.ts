/**
 * Sandbox API Authentication
 * Gets access token from Sandbox authenticate endpoint
 * Token is valid for 24 hours
 */

const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET
const SANDBOX_HOST = process.env.SANDBOX_HOST || 'https://api.sandbox.co.in'

interface TokenCache {
  token: string | null
  expiresAt: number
}

let tokenCache: TokenCache = {
  token: null,
  expiresAt: 0,
}

/**
 * Get Sandbox access token
 * Caches the token until it expires (24 hours validity)
 */
export async function getSandboxAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  const now = Date.now()
  if (tokenCache.token && tokenCache.expiresAt > now) {
    return tokenCache.token
  }

  if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
    throw new Error('Sandbox API credentials not configured')
  }

  try {
    const response = await fetch(`${SANDBOX_HOST}/authenticate`, {
      method: 'POST',
      headers: {
        'x-api-key': SANDBOX_API_KEY!,
        'x-api-secret': SANDBOX_API_SECRET!,
        'x-api-version': '1.0',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.message || `Authentication failed: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()

    if (data.code === 200 && data.data?.access_token) {
      const accessToken = data.data.access_token
      // Cache the token with 23 hours expiry (slightly less than 24 hours for safety)
      tokenCache = {
        token: accessToken,
        expiresAt: now + 23 * 60 * 60 * 1000, // 23 hours in milliseconds
      }
      return accessToken
    } else {
      throw new Error('Invalid response from authentication endpoint')
    }
  } catch (error: any) {
    console.error('[Sandbox Authentication Error]:', error)
    throw new Error(`Failed to authenticate with Sandbox API: ${error.message}`)
  }
}
