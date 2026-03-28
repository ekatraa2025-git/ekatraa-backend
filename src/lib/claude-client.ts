import Anthropic from '@anthropic-ai/sdk'

let cached: Anthropic | null = null
let cachedKey: string | null = null

export function getClaudeApiKey(): string {
    const key = process.env.CLAUDE_API_KEY?.trim() || ''
    if (!key) {
        throw new Error('CLAUDE_API_KEY is not configured')
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
