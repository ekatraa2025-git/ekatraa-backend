import { supabase } from '@/lib/supabase/server'
import { getClaudeModel } from '@/lib/claude-client'
import { getDefaultOpenRouterModel, getDefaultOpenRouterImageModel, getDefaultOpenRouterInviteAnimatedModel, resolveOpenRouterInviteVideoModel } from '@/lib/openrouter-client'

export type AiPrimaryProvider = 'openrouter' | 'claude' | 'gemini'

export type AiRuntimeSettings = {
    provider: AiPrimaryProvider
    primaryModel: string
    openrouterModel: string
    openrouterImageModel: string
    openrouterInviteAnimatedModel: string
    claudeModel: string
    geminiModel: string
}

/** Stable default; avoid preview/lite IDs in prod (Google 503 capacity errors). */
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'

function safeProvider(raw: unknown): AiPrimaryProvider {
    const v = String(raw || '').trim().toLowerCase()
    if (v === 'claude' || v === 'gemini' || v === 'openrouter') return v
    return 'openrouter'
}

export async function getAiRuntimeSettings(): Promise<AiRuntimeSettings> {
    const envClaude = getClaudeModel()
    const envGemini = String(process.env.MASTRA_GEMINI_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim()
    const envOpenRouter = String(process.env.OPENROUTER_MODEL || getDefaultOpenRouterModel()).trim()
    const envOpenRouterImage = getDefaultOpenRouterImageModel()
    const envOpenRouterAnim = getDefaultOpenRouterInviteAnimatedModel()

    const { data } = await supabase
        .from('platform_settings')
        .select(
            'ai_primary_provider, ai_primary_model, ai_openrouter_model, ai_openrouter_image_model, ai_openrouter_invite_animated_model, ai_claude_model, ai_gemini_model'
        )
        .eq('id', 'default')
        .maybeSingle()

    const provider = safeProvider(data?.ai_primary_provider)
    const openrouterModel = String(data?.ai_openrouter_model || envOpenRouter).trim() || envOpenRouter
    const openrouterImageModel = String(data?.ai_openrouter_image_model || envOpenRouterImage).trim() || envOpenRouterImage
    const openrouterInviteAnimatedModel = resolveOpenRouterInviteVideoModel(
        data?.ai_openrouter_invite_animated_model || envOpenRouterAnim
    )
    const claudeModel = String(data?.ai_claude_model || envClaude).trim() || envClaude
    const geminiModel = String(data?.ai_gemini_model || envGemini).trim() || envGemini

    const selectedByProvider =
        provider === 'openrouter' ? openrouterModel : provider === 'claude' ? claudeModel : geminiModel
    const primaryModel = String(data?.ai_primary_model || selectedByProvider).trim() || selectedByProvider

    return {
        provider,
        primaryModel,
        openrouterModel,
        openrouterImageModel,
        openrouterInviteAnimatedModel,
        claudeModel,
        geminiModel,
    }
}
