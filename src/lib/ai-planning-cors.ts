/**
 * CORS for ekatraa-web (and other origins) calling planning APIs from the browser.
 * Set EKATRAA_WEB_ORIGINS to a comma-separated allowlist, e.g. https://www.ekatraa.com,http://localhost:3001
 */
export function planningCorsHeaders(request: Request): HeadersInit {
    const origin = request.headers.get('origin') || ''
    const allowlist = (process.env.EKATRAA_WEB_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    const strict = String(process.env.EKATRAA_WEB_ORIGINS_STRICT || '').trim() === '1'
    const wildcardMatch = allowlist.includes('*')
    const listed = origin && allowlist.includes(origin)
    const allow =
        allowlist.length === 0 || wildcardMatch
            ? '*'
            : listed
              ? origin
              : strict
                ? allowlist[0] || '*'
                : origin || allowlist[0] || '*'
    return {
        'Access-Control-Allow-Origin': allow,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-Thread-Id, Accept, Accept-Language, Origin',
        Vary: 'Origin',
    }
}
