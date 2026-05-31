import { getOpenRouterApiKey } from '@/lib/openrouter-client'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export type OpenRouterVideoFrameImage = {
    type: 'image_url'
    image_url: { url: string }
    frame_type?: 'first_frame' | 'last_frame'
}

export type OpenRouterVideoReferenceImage = {
    type: 'image_url'
    image_url: { url: string }
}

export function openRouterImageUrlEntry(url: string, frameType?: 'first_frame' | 'last_frame'): OpenRouterVideoFrameImage {
    const entry: OpenRouterVideoFrameImage = { type: 'image_url', image_url: { url: String(url).trim() } }
    if (frameType) entry.frame_type = frameType
    return entry
}

export function openRouterReferenceImageEntry(url: string): OpenRouterVideoReferenceImage {
    return { type: 'image_url', image_url: { url: String(url).trim() } }
}

export type OpenRouterVideoJobResult = {
    jobId: string
    videoBuffer: Buffer
    contentType: string
    costUsd: number | null
    model: string
    status: 'completed'
}

function openRouterAuthHeaders(init?: RequestInit): Headers {
    const apiKey = getOpenRouterApiKey()
    const appUrl = String(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim()
    const appName = String(process.env.APP_NAME || 'Ekatraa Backend').trim()
    const headers = new Headers(init?.headers || {})
    headers.set('Authorization', `Bearer ${apiKey}`)
    if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json')
    if (appUrl) headers.set('HTTP-Referer', appUrl)
    headers.set('X-Title', appName)
    headers.set('X-OpenRouter-Title', appName)
    return headers
}

async function openRouterVideoFetch(path: string, init?: RequestInit): Promise<Response> {
    const normalized = path.startsWith('http') ? path : `${OPENROUTER_BASE}${path.startsWith('/') ? path : `/${path}`}`
    return fetch(normalized, { ...init, headers: openRouterAuthHeaders(init), cache: 'no-store' })
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Submit async video job to OpenRouter POST /videos, poll until completed, download content.
 * @see https://openrouter.ai/docs/guides/overview/multimodal/video-generation
 */
export async function generateVideoWithOpenRouter(input: {
    model: string
    prompt: string
    duration?: number
    resolution?: string
    aspect_ratio?: string
    frame_images?: OpenRouterVideoFrameImage[]
    input_references?: OpenRouterVideoReferenceImage[]
    generate_audio?: boolean
    pollIntervalMs?: number
    maxPollAttempts?: number
}): Promise<OpenRouterVideoJobResult> {
    const model = String(input.model || '').trim()
    if (!model) throw new Error('OpenRouter video model is not configured')

    const payload: Record<string, unknown> = {
        model,
        prompt: input.prompt,
    }
    if (input.duration != null) payload.duration = input.duration
    if (input.resolution) payload.resolution = input.resolution
    if (input.aspect_ratio) payload.aspect_ratio = input.aspect_ratio
    if (input.frame_images?.length) payload.frame_images = input.frame_images
    if (input.input_references?.length) payload.input_references = input.input_references
    if (input.generate_audio != null) payload.generate_audio = input.generate_audio

    const submitRes = await openRouterVideoFetch('/videos', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    const submitJson = (await submitRes.json().catch(() => null)) as Record<string, unknown> | null
    if (!submitRes.ok) {
        const msg = String(
            submitJson?.error && typeof submitJson.error === 'object' && 'message' in submitJson.error
                ? (submitJson.error as { message?: string }).message
                : submitJson?.message || submitRes.statusText || 'OpenRouter video submit failed'
        )
        throw new Error(msg)
    }

    const jobId = String(submitJson?.id || '')
    const pollingUrl = String(submitJson?.polling_url || `/videos/${jobId}`)
    if (!jobId) throw new Error('OpenRouter video job id missing')

    const pollPath = pollingUrl.startsWith('http')
        ? pollingUrl
        : `/videos/${jobId}`
    const pollEvery = Math.max(5000, input.pollIntervalMs ?? 15000)
    const maxAttempts = input.maxPollAttempts ?? 40

    let lastStatus: Record<string, unknown> | null = null
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) await sleep(pollEvery)
        const pollRes = await openRouterVideoFetch(pollPath, { method: 'GET' })
        const statusJson = (await pollRes.json().catch(() => null)) as Record<string, unknown> | null
        if (!pollRes.ok) {
            const msg = String(statusJson?.message || pollRes.statusText || 'OpenRouter video poll failed')
            throw new Error(msg)
        }
        lastStatus = statusJson
        const st = String(statusJson?.status || '').toLowerCase()
        if (st === 'failed') {
            throw new Error(String(statusJson?.error || 'OpenRouter video generation failed'))
        }
        if (st === 'completed') break
    }

    if (String(lastStatus?.status || '').toLowerCase() !== 'completed') {
        throw new Error('OpenRouter video generation timed out')
    }

    const usage = lastStatus?.usage as { cost?: number } | undefined
    const costUsd = usage?.cost != null ? Number(usage.cost) : null
    const unsignedUrls = Array.isArray(lastStatus?.unsigned_urls) ? (lastStatus!.unsigned_urls as string[]) : []
    const contentPath =
        unsignedUrls[0] ||
        `/videos/${jobId}/content?index=0`
    const contentUrl = contentPath.startsWith('http')
        ? contentPath
        : `${OPENROUTER_BASE}${contentPath.replace(/^\//, '')}`

    const videoRes = await openRouterVideoFetch(contentUrl, { method: 'GET' })
    if (!videoRes.ok) {
        throw new Error('Could not download generated video from OpenRouter')
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
    const contentType = videoRes.headers.get('content-type') || 'video/mp4'

    return {
        jobId,
        videoBuffer,
        contentType,
        costUsd: Number.isFinite(costUsd as number) ? (costUsd as number) : null,
        model,
        status: 'completed',
    }
}
