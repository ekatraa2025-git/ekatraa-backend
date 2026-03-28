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
    // Join with newline: Anthropic often sends multiple text blocks (e.g. echo + answer) with no separator;
    // joining with '' merges into one line and breaks line-based stripping.
    return message.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => (typeof b.text === 'string' ? b.text : ''))
        .filter(Boolean)
        .join('\n')
}

/** Remove model-id echoes anywhere in the string (lines or inline / concatenated blocks). */
export function redactAnthropicModelEcho(s: string): string {
    let t = typeof s === 'string' ? s.trim() : ''
    // Prefix like "model: claude-3-5-..." possibly glued to real text without newline
    t = t.replace(/^\s*model\s*[:：]\s*claude[-\w.]*/i, '')
    t = inlineRedactClaudeIds(t)
    t = t
        .split('\n')
        .map((line) =>
            line
                .replace(/\bmodel\s*[:：]\s*claude[-\w.]*\b/gi, '')
                .replace(/\bassistant\s*model\s*[:：]\s*[^\s]+/gi, '')
                .trimEnd()
        )
        .filter((line) => {
            const x = line.trim()
            if (!x) return false
            if (/^claude[-a-z0-9.]+$/i.test(x) && x.length < 96) return false
            if (/^model\s*[:：]\s*$/i.test(x)) return false
            return true
        })
        .join('\n')
        .trim()
    return inlineRedactClaudeIds(t)
}

function inlineRedactClaudeIds(t: string): string {
    return t
        .replace(/\bclaude-(?:3|sonnet|opus|haiku)[-\d.a-z]*\b/gi, '')
        .replace(/\bclaude-\d[\w.-]*\b/gi, '')
        .replace(/\bmodel\s*[:：]\s*claude\b/gi, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

/** Drop lines that only echo the model id (assistant sometimes prints `model: claude-...`). */
export function stripModelEchoLines(s: string): string {
    return redactAnthropicModelEcho(s)
}

/** Clean assistant reply before sending to clients. */
export function sanitizeAssistantReplyText(s: string): string {
    const out = redactAnthropicModelEcho(s.trim())
    if (!out || /^model\s*[:：]\s*$/i.test(out)) return ''
    return out
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
            if (!message && typeof (er as { model?: unknown }).model === 'string') {
                message =
                    'Anthropic API declined the request. Confirm billing, model access, and your API key in the Anthropic Console.'
            }
        }
        if (!message) {
            message = e.message.replace(/^\d{3}\s+/, '').trim() || e.message || 'Anthropic API error'
        }
        message = redactAnthropicModelEcho(message)
        return {
            status: e.status,
            body: {
                error: message || 'Anthropic API error',
                request_id: e.requestID ?? undefined,
            },
        }
    }
    const msg = e instanceof Error ? e.message : 'Unknown error'
    if (msg.includes('CLAUDE_API_KEY') || msg.includes('ANTHROPIC_API_KEY')) {
        return { status: 503, body: { error: msg } }
    }
    return { status: 500, body: { error: redactAnthropicModelEcho(msg) || msg } }
}
