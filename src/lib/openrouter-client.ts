type OpenRouterMessage = { role: 'system' | 'user' | 'assistant'; content: string }

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3-nano-omni:free'
const DEFAULT_OPENROUTER_IMAGE_MODEL = 'sourceful/riverflow-v2-fast'
const DEFAULT_OPENROUTER_INVITE_ANIMATED_MODEL = 'sourceful/riverflow-v2-pro'

function isOpenRouterDebugLogsEnabled(): boolean {
    const raw = String(process.env.OPENROUTER_DEBUG_LOGS || '').trim().toLowerCase()
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/**
 * Reads the OpenRouter key from the **server** environment (never from Expo PUBLIC_ vars).
 * Accepts a few common naming mistakes. Strips accidental "Bearer " prefix.
 */
export function getOpenRouterApiKey(): string {
    const candidates = [
        process.env.OPENROUTER_API_KEY,
        process.env.OPEN_ROUTER_API_KEY,
        process.env.OPENROUTER_KEY,
    ]
    let key = ''
    for (const raw of candidates) {
        const v = String(raw ?? '').trim()
        if (v) {
            key = v.replace(/^Bearer\s+/i, '').trim()
            break
        }
    }
    if (!key) {
        throw new Error(
            'OpenRouter is not configured on this server: set OPENROUTER_API_KEY. ' +
                'If the mobile app uses a deployed API (e.g. Vercel), add OPENROUTER_API_KEY in the host project Environment Variables and redeploy—local .env.local only applies when you run the backend locally and point the app at that URL.'
        )
    }
    return key
}

export function getDefaultOpenRouterModel(): string {
    return DEFAULT_OPENROUTER_MODEL
}

export function getDefaultOpenRouterImageModel(): string {
    const env = String(process.env.OPENROUTER_IMAGE_MODEL || '').trim()
    return env || DEFAULT_OPENROUTER_IMAGE_MODEL
}

export function getDefaultOpenRouterInviteAnimatedModel(): string {
    const env = String(process.env.OPENROUTER_INVITE_ANIMATED_MODEL || '').trim()
    return env || DEFAULT_OPENROUTER_INVITE_ANIMATED_MODEL
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

export async function listOpenRouterModels(opts?: { outputModalities?: string }) {
    const modalities = String(opts?.outputModalities ?? 'all').trim() || 'all'
    const q = `?output_modalities=${encodeURIComponent(modalities)}`
    const res = await openRouterFetch(`/models${q}`, { method: 'GET' })
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

/** Image generations can exceed 4k “tokens”; capping at 2048 truncates the response and drops the image payload. */
const IMAGE_COMPLETION_MAX_TOKENS = 32768

function extractDataUrlFromString(s: string): string | null {
    const t = String(s || '').trim()
    if (t.startsWith('data:image/')) return t
    const m = t.match(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=_-]+/i)
    return m ? m[0] : null
}

function pickUrlFromImagePart(im: Record<string, unknown>): string | null {
    const holder = (im.image_url ?? im.imageUrl) as Record<string, unknown> | string | undefined
    if (holder && typeof holder === 'object') {
        const u = (holder as Record<string, unknown>).url ?? (holder as Record<string, unknown>).uri
        if (typeof u === 'string' && u.length > 0) return u
    }
    if (typeof holder === 'string' && holder.length > 0) return holder

    const topUrl = (im.url ?? im.uri) as unknown
    if (typeof topUrl === 'string' && topUrl.length > 0) return topUrl

    const b64 = (im.b64_json ?? im.base64 ?? im.data) as unknown
    if (typeof b64 === 'string' && b64.length > 0) {
        if (b64.startsWith('data:image/')) return b64
        return `data:image/png;base64,${b64}`
    }
    return null
}

function pickFirstImageUrlFromMessage(message: Record<string, unknown>): string | null {
    const images = message.images
    if (Array.isArray(images)) {
        for (const img of images) {
            if (!img || typeof img !== 'object') continue
            const im = img as Record<string, unknown>
            const fromPart = pickUrlFromImagePart(im)
            if (fromPart) return fromPart
            if (String(im.type || '').toLowerCase() === 'image_url') {
                const u = pickUrlFromImagePart(im)
                if (u) return u
            }
        }
    }

    const content = message.content
    if (typeof content === 'string') {
        const direct = extractDataUrlFromString(content)
        if (direct) return direct
    }
    if (Array.isArray(content)) {
        for (const part of content) {
            if (!part || typeof part !== 'object') continue
            const p = part as Record<string, unknown>
            const typ = String(p.type || '').toLowerCase()
            if (typ === 'image_url' || typ === 'image' || typ === 'output_image') {
                const u = pickUrlFromImagePart(p)
                if (u) return u
                if (p.image_url && typeof p.image_url === 'object') {
                    const url = (p.image_url as Record<string, unknown>).url
                    if (typeof url === 'string' && url.length > 0) return url
                }
            }
        }
    }
    return null
}

function deepScanForImageRef(obj: unknown, depth = 0): string | null {
    if (depth > 12) return null
    if (typeof obj === 'string') {
        const d = extractDataUrlFromString(obj)
        if (d && d.length > 80) return d
        if (/^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?|#|$)/i.test(obj)) return obj.trim()
        return null
    }
    if (!obj || typeof obj !== 'object') return null
    if (Array.isArray(obj)) {
        for (const x of obj) {
            const f = deepScanForImageRef(x, depth + 1)
            if (f) return f
        }
        return null
    }
    for (const v of Object.values(obj as Record<string, unknown>)) {
        const f = deepScanForImageRef(v, depth + 1)
        if (f) return f
    }
    return null
}

function extractImageRefFromChatCompletion(json: Record<string, unknown>): string | null {
    const choice = json?.choices
    if (!Array.isArray(choice) || !choice[0] || typeof choice[0] !== 'object') {
        return deepScanForImageRef(json)
    }
    const c0 = choice[0] as Record<string, unknown>
    const msg = c0.message
    if (msg && typeof msg === 'object') {
        const m = msg as Record<string, unknown>
        const direct = pickFirstImageUrlFromMessage(m)
        if (direct) return direct
        const deep = deepScanForImageRef(m)
        if (deep) return deep
    }
    return deepScanForImageRef(c0)
}

function modelPrefersImageOnlyFirst(model: string): boolean {
    return /sourceful|riverflow|flux|black-forest|gemini.*image|image-preview/i.test(model)
}

/**
 * Image generation via OpenRouter chat/completions + modalities.
 * Tries image+text then image-only when the first attempt returns no image.
 */
export async function generateImageWithOpenRouter(input: {
    model: string
    prompt: string
    sessionId?: string
    imageConfig?: Record<string, unknown>
}): Promise<{ imageRef: string; model: string }> {
    const model = String(input.model || '').trim()
    if (!model) throw new Error('OpenRouter image model is not configured')

    const modalitySets: Array<Array<'image' | 'text'>> = modelPrefersImageOnlyFirst(model)
        ? [
              ['image'],
              ['image', 'text'],
          ]
        : [
              ['image', 'text'],
              ['image'],
          ]

    let lastErr = 'OpenRouter returned no image'
    for (const modalities of modalitySets) {
        const res = await openRouterFetch('/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: input.prompt }],
                modalities,
                max_tokens: IMAGE_COMPLETION_MAX_TOKENS,
                max_completion_tokens: IMAGE_COMPLETION_MAX_TOKENS,
                ...(input.imageConfig && Object.keys(input.imageConfig).length > 0
                    ? { image_config: input.imageConfig }
                    : {}),
                ...(input.sessionId?.trim() ? { session_id: input.sessionId.trim() } : {}),
            }),
        })
        const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
        if (!res.ok) {
            lastErr = String(json?.error && typeof json.error === 'object' && 'message' in json.error
                ? (json.error as { message?: string }).message
                : json?.message || res.statusText || 'OpenRouter image request failed')
            continue
        }
        if (!json) {
            lastErr = 'Empty OpenRouter response'
            continue
        }
        const imageRef = extractImageRefFromChatCompletion(json)
        if (imageRef) return { imageRef, model }

        if (isOpenRouterDebugLogsEnabled()) {
            const msg = (json.choices as unknown[])
                ? JSON.stringify((json.choices as Record<string, unknown>[])[0]?.message ?? null, (_, v) =>
                      typeof v === 'string' && v.length > 200 && v.startsWith('data:image/')
                          ? `${v.slice(0, 48)}…(truncated)…`
                          : v
                  ).slice(0, 2400)
                : 'no choices'
            console.warn('[OpenRouter][image] no image ref in response; first choice message (truncated)=', msg)
        }
        lastErr = 'OpenRouter response contained no usable image URL or data URL'
    }

    throw new Error(lastErr)
}
