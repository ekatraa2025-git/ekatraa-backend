import type { NextResponse } from 'next/server'

/**
 * CORS for ekatraa-web (and other origins) calling planning APIs from the browser.
 *
 * Set EKATRAA_WEB_ORIGINS to a comma-separated allowlist, e.g.
 * https://www.ekatraa.in,https://ekatraa.in,http://localhost:3001
 *
 * When unset, production defaults below are merged in so Vercel deploys work without
 * forgetting env vars. Set EKATRAA_WEB_ORIGINS_STRICT=1 to reject unknown origins.
 */
const DEFAULT_WEB_ORIGINS = ['https://www.ekatraa.in', 'https://ekatraa.in'] as const

function parseAllowlist(): string[] {
    const fromEnv = (process.env.EKATRAA_WEB_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    const merged = [...DEFAULT_WEB_ORIGINS, ...fromEnv]
    return [...new Set(merged)]
}

export function isBrowserPlanningApiPath(pathname: string): boolean {
    return (
        pathname.startsWith('/api/public/ai/planning/') ||
        pathname.startsWith('/api/public/ai/voice/') ||
        pathname.startsWith('/api/vendor/ai/planning/') ||
        pathname.startsWith('/api/vendor/ai/voice/') ||
        pathname.startsWith('/api/public/compliance/vendor-delete')
    )
}

export function planningCorsHeaders(request: Request): HeadersInit {
    const origin = request.headers.get('origin') || ''
    const requestedHeaders = request.headers.get('Access-Control-Request-Headers')
    const allowlist = parseAllowlist()
    const strict = String(process.env.EKATRAA_WEB_ORIGINS_STRICT || '').trim() === '1'
    const wildcardMatch = allowlist.includes('*')
    const listed = Boolean(origin && allowlist.includes(origin))

    let allow: string
    if (wildcardMatch) {
        allow = '*'
    } else if (listed) {
        allow = origin
    } else if (strict) {
        allow = allowlist[0] || '*'
    } else if (origin) {
        // Non-strict: echo request origin so browser preflight succeeds (dev / preview URLs).
        allow = origin
    } else {
        allow = allowlist[0] || '*'
    }

    const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers':
            requestedHeaders ||
            'Content-Type, Authorization, X-Thread-Id, Accept, Accept-Language, Origin, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin, Access-Control-Request-Headers',
    }

    if (allow !== '*') {
        headers['Access-Control-Allow-Credentials'] = 'true'
    }

    return headers
}

export function applyPlanningCorsHeaders(request: Request, response: NextResponse): NextResponse {
    const cors = planningCorsHeaders(request)
    for (const [key, value] of Object.entries(cors)) {
        response.headers.set(key, value)
    }
    return response
}
