type OpenRouterMessage = { role: 'system' | 'user' | 'assistant'; content: string }

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3-nano-omni:free'

function isOpenRouterDebugLogsEnabled(): boolean {
    const raw = String(process.env.OPENROUTER_DEBUG_LOGS || '').trim().toLowerCase()
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export function getOpenRouterApiKey(): string {
    const key = String(process.env.OPENROUTER_API_KEY || '').trim()
    if (!key) {
        throw new Error('OPENROUTER_API_KEY is not configured')
    }
    return key
}

export function getDefaultOpenRouterModel(): string {
    return DEFAULT_OPENROUTER_MODEL
}

async function openRouterFetch(path: string, init?: RequestInit): Promise<Response> {
    const apiKey = getOpenRouterApiKey()
    const appUrl = String(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim()
    const appName = String(process.env.APP_NAME || 'Ekatraa Backend').trim()
    const headers = new Headers(init?.headers || {})
    headers.set('Authorization', `Bearer ${apiKey}`)
    headers.set('Content-Type', 'application/json')
    if (appUrl) headers.set('HTTP-Referer', appUrl)
    // Keep both headers for compatibility with OpenRouter dashboard attribution.
    headers.set('X-Title', appName)
    headers.set('X-OpenRouter-Title', appName)
    return fetch(`${OPENROUTER_BASE}${path}`, { ...init, headers, cache: 'no-store' })
}

export async function listOpenRouterModels() {
    const res = await openRouterFetch('/models', { method: 'GET' })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
        const msg = String(json?.error?.message || json?.message || res.statusText || 'Failed to fetch OpenRouter models')
        throw new Error(msg)
    }
    const data = Array.isArray(json?.data) ? json.data : []
    return data
        .map((m: Record<string, unknown>) => ({
            id: String(m?.id || ''),
            name: String(m?.name || m?.id || ''),
            context_length: Number(m?.context_length || 0) || 0,
            pricing: m?.pricing || null,
        }))
        .filter((m: { id: string }) => !!m.id)
}

export async function getOpenRouterBalance() {
    const res = await openRouterFetch('/credits', { method: 'GET' })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
        const msg = String(json?.error?.message || json?.message || res.statusText || 'Failed to fetch OpenRouter balance')
        throw new Error(msg)
    }
    return {
        total_credits: Number(json?.data?.total_credits ?? 0),
        total_usage: Number(json?.data?.total_usage ?? 0),
    }
}

export async function chatWithOpenRouter(input: {
    model?: string
    system?: string
    messages: OpenRouterMessage[]
    temperature?: number
    maxTokens?: number
    sessionId?: string
}) {
    const model = String(input.model || '').trim() || getDefaultOpenRouterModel()
    const messages: OpenRouterMessage[] = []
    if (input.system?.trim()) {
        messages.push({ role: 'system', content: input.system.trim() })
    }
    messages.push(...input.messages)
    const sessionId = String(input.sessionId || '').trim()
    const isNvidiaModel = /nvidia|nemotron/i.test(model)
    const debugLogs = isOpenRouterDebugLogsEnabled()
    const started = Date.now()

    if (debugLogs && isNvidiaModel) {
        console.info('[OpenRouter][NVIDIA] request.start', {
            model,
            session_id: sessionId || null,
            message_count: messages.length,
            has_system: !!input.system?.trim(),
        })
    }

    const res = await openRouterFetch('/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
            model,
            messages,
            temperature: typeof input.temperature === 'number' ? input.temperature : 0.6,
            max_tokens: typeof input.maxTokens === 'number' ? input.maxTokens : 2048,
            ...(sessionId ? { session_id: sessionId } : {}),
        }),
    })
    const json = await res.json().catch(() => null)
    const elapsedMs = Date.now() - started
    if (!res.ok) {
        const msg = String(
            json?.error?.message || json?.message || res.statusText || 'OpenRouter request failed'
        )
        if (debugLogs && isNvidiaModel) {
            console.error('[OpenRouter][NVIDIA] request.error', {
                model,
                session_id: sessionId || null,
                status: res.status,
                elapsed_ms: elapsedMs,
                error: msg,
            })
        }
        throw new Error(msg)
    }
    const text = String(json?.choices?.[0]?.message?.content || '').trim()
    if (!text) throw new Error('OpenRouter returned empty reply')
    if (debugLogs && isNvidiaModel) {
        console.info('[OpenRouter][NVIDIA] request.success', {
            model,
            session_id: sessionId || null,
            request_id: String(json?.id || ''),
            provider: String(json?.provider || ''),
            usage: json?.usage || null,
            elapsed_ms: elapsedMs,
        })
    }
    return { text, model }
}
