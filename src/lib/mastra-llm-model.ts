<<<<<<< HEAD
/**
 * Mastra agent model IDs use `provider/model` (see @mastra/core model router).
 * Default to a **stable** GA Flash model. Preview/lite IDs (e.g. gemini-3.1-flash-lite-preview) often return
 * 503 "high demand" under load (provider capacity), which surfaces as AI_APICallError in chat.
 * Override with MASTRA_GEMINI_MODEL / GEMINI_MODEL or platform_settings.ai_gemini_model when needed.
 */
export const DEFAULT_MASTRA_GEMINI_MODEL = 'gemini-2.0-flash'

=======
import type { ModelWithRetries } from '@mastra/core/agent'
import type { MastraModelConfig } from '@mastra/core/llm'
import type { AiPrimaryProvider, AiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { getDefaultOpenRouterModel } from '@/lib/openrouter-client'

/**
 * Mastra agent `model` IDs use `provider/model` (see @mastra/core provider registry).
 * Order follows admin **AI primary provider** (`platform_settings.ai_primary_provider`), then the other two as fallbacks.
 * OpenRouter slug comes from `ai_openrouter_model`, or `ai_primary_model` when primary is OpenRouter (see {@link resolveOpenRouterSlugForRuntime}).
 */
export const DEFAULT_MASTRA_GEMINI_MODEL = 'gemini-2.0-flash'

>>>>>>> 6ce4ae0 (Vendor Deletion fixes)
/** Gemini model id only (e.g. gemini-2.0-flash). */
export function getMastraGeminiModelId(): string {
    return (process.env.MASTRA_GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_MASTRA_GEMINI_MODEL).trim()
}

/**
 * Legacy single-model label (Gemini). Prefer {@link buildMastraAgentModelFallbacks} for agents.
 */
export function getMastraLlmModelString(): string {
    return `google/${getMastraGeminiModelId()}`
}

export function stripOpenRouterSlugPrefix(slug: string): string {
    const t = slug.trim()
    const prefix = 'openrouter/'
    return t.startsWith(prefix) ? t.slice(prefix.length) : t
}

function toOpenRouterMastraId(slug: string): string {
    return `openrouter/${stripOpenRouterSlugPrefix(slug)}`
}

function toGoogleMastraId(modelId: string): string {
    const t = modelId.trim().replace(/^google\//, '')
    return `google/${t}`
}

function toAnthropicMastraId(modelId: string): string {
    const t = modelId.trim().replace(/^anthropic\//, '')
    return `anthropic/${t}`
}

/** Admin OpenRouter picker (`ai_openrouter_model`) or primary model when provider is OpenRouter. */
export function resolveOpenRouterSlugForRuntime(runtime: AiRuntimeSettings): string {
    const dedicated = String(runtime.openrouterModel || '').trim()
    if (dedicated) return stripOpenRouterSlugPrefix(dedicated)
    if (runtime.provider === 'openrouter') {
        const pm = String(runtime.primaryModel || '').trim()
        if (pm) return stripOpenRouterSlugPrefix(pm)
    }
    return getDefaultOpenRouterModel()
}

function orderedProviders(primary: AiPrimaryProvider): AiPrimaryProvider[] {
    const all: AiPrimaryProvider[] = ['openrouter', 'gemini', 'claude']
    return [primary, ...all.filter((p) => p !== primary)]
}

/**
 * Models aligned with admin **primary AI provider**, then fallbacks (OpenRouter, Gemini, Claude).
 * Uses `platform_settings` via {@link AiRuntimeSettings}; Mastra retries each entry before advancing.
 */
export function buildMastraAgentModelFallbacks(runtime: AiRuntimeSettings): ModelWithRetries[] {
    const openrouter = toOpenRouterMastraId(resolveOpenRouterSlugForRuntime(runtime))
    const google = toGoogleMastraId(runtime.geminiModel || getMastraGeminiModelId())
    const anthropic = toAnthropicMastraId(runtime.claudeModel || 'claude-sonnet-4-6')

    const mastraByProvider: Record<AiPrimaryProvider, string> = {
        openrouter: openrouter,
        gemini: google,
        claude: anthropic,
    }

    const seen = new Set<string>()
    const out: ModelWithRetries[] = []
    for (const p of orderedProviders(runtime.provider)) {
        const id = mastraByProvider[p]
        if (seen.has(id)) continue
        seen.add(id)
        out.push({ model: id, maxRetries: 2 })
    }
    return out
}

/**
 * Cast for `agent.generate` / `agent.stream` `model` overrides.
 * Runtime resolves `ModelWithRetries[]`; public typings only expose `MastraModelConfig`.
 */
export function mastraAgentModelForInvocation(runtime: AiRuntimeSettings): MastraModelConfig {
    return buildMastraAgentModelFallbacks(runtime) as unknown as MastraModelConfig
}

/** Env/bootstrap fallback when DB settings are not loaded (e.g. `mastra dev`). */
export function buildDefaultMastraAgentModelFallbacksFromEnv(): ModelWithRetries[] {
    const openrouter = toOpenRouterMastraId(stripOpenRouterSlugPrefix(process.env.OPENROUTER_MODEL || getDefaultOpenRouterModel()))
    const google = toGoogleMastraId(getMastraGeminiModelId())
    const anthropic = toAnthropicMastraId(process.env.CLAUDE_MODEL || 'claude-sonnet-4-6')
    return [
        { model: openrouter, maxRetries: 2 },
        { model: google, maxRetries: 2 },
        { model: anthropic, maxRetries: 2 },
    ]
}
