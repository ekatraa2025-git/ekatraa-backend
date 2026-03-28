import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const { init } = require('@heyputer/puter.js/src/init.cjs') as {
    init: (authToken?: string) => {
        ai: { chat: (...args: unknown[]) => Promise<unknown> }
    }
}

type PuterInstance = ReturnType<typeof init>

let cached: PuterInstance | null = null
let cachedToken: string | null = null

export function getPuterAuthToken(): string {
    const token =
        process.env.PUTER_AUTH_TOKEN?.trim() || process.env.puterAuthToken?.trim() || ''
    if (!token) {
        throw new Error('PUTER_AUTH_TOKEN is not configured')
    }
    return token
}

export function getPuterClient(): PuterInstance {
    const token = getPuterAuthToken()
    if (cached && cachedToken === token) {
        return cached
    }
    cached = init(token)
    cachedToken = token
    return cached
}

/** Default: Claude 3.5 Sonnet via Puter ([models list](https://developer.puter.com/tutorials/free-unlimited-claude-35-sonnet-api/)). */
export function getPuterAiModel(): string {
    return (process.env.PUTER_AI_MODEL || 'claude-3-5-sonnet').trim()
}

export function extractPuterChatText(response: unknown): string {
    if (response == null) return ''
    if (typeof response === 'string') return response
    if (typeof response !== 'object') return ''
    const r = response as Record<string, unknown>
    const msg = r.message
    if (msg && typeof msg === 'object') {
        const m = msg as Record<string, unknown>
        const c = m.content
        if (typeof c === 'string') return c
        if (Array.isArray(c)) {
            return c
                .map((part) => {
                    if (part && typeof part === 'object' && 'text' in part) {
                        const t = (part as { text?: unknown }).text
                        return typeof t === 'string' ? t : ''
                    }
                    return ''
                })
                .join('')
        }
    }
    const ts = r.toString
    if (typeof ts === 'function') {
        try {
            const s = ts.call(response)
            if (typeof s === 'string') return s
        } catch {
            /* ignore */
        }
    }
    return ''
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Request'): Promise<T> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
        promise.then(
            (v) => {
                clearTimeout(t)
                resolve(v)
            },
            (e) => {
                clearTimeout(t)
                reject(e)
            }
        )
    })
}
