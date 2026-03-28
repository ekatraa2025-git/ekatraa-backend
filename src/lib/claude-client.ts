import Anthropic, { APIError } from '@anthropic-ai/sdk'

let cached: Anthropic | null = null
let cachedKey: string | null = null

export function getClaudeApiKey(): string {
    const key =
        process.env.CLAUDE_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim() || ''
    if (!key) {
        throw new Error('CLAUDE_API_KEY or ANTHROPIC_API_KEY is not configured')
    }
    return key
}

export function getClaudeModel(): string {
    return (process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022').trim()
}

export function getAnthropicClient(): Anthropic {
    const key = getClaudeApiKey()
    if (cached && cachedKey === key) {
        return cached
    }
    cached = new Anthropic({ apiKey: key })
    cachedKey = key
    return cached
}

export function extractAnthropicText(message: Anthropic.Messages.Message): string {
    return message.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
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

/** Maps Anthropic API errors to an HTTP response (preserves their status, e.g. 400 billing errors). */
export function anthropicErrorToHttp(e: unknown): {
    status: number
    body: { error: string; request_id?: string }
} {
    if (e instanceof APIError && typeof e.status === 'number') {
        const er = e.error as Record<string, unknown> | undefined
        let message = ''
        if (er && typeof er === 'object') {
            if (typeof er.message === 'string') {
                message = er.message
            } else {
                const inner = er.error as { message?: string } | undefined
                if (inner && typeof inner.message === 'string') {
                    message = inner.message
                }
            }
        }
        if (!message) {
            message = e.message.replace(/^\d{3}\s+/, '').trim() || e.message || 'Anthropic API error'
        }
        return {
            status: e.status,
            body: {
                error: message,
                request_id: e.requestID ?? undefined,
            },
        }
    }
    const msg = e instanceof Error ? e.message : 'Unknown error'
    if (msg.includes('CLAUDE_API_KEY') || msg.includes('ANTHROPIC_API_KEY')) {
        return { status: 503, body: { error: msg } }
    }
    return { status: 500, body: { error: msg } }
}
