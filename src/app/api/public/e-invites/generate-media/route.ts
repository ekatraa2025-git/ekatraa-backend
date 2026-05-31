import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { supabase } from '@/lib/supabase/server'
import { getAiRuntimeSettings } from '@/lib/ai-runtime-settings'
import { mastraAgentModelForInvocation } from '@/lib/mastra-llm-model'
import { generateImageWithOpenRouter } from '@/lib/openrouter-client'
import { priceInrForMediaKind, type EInviteMediaKind } from '@/lib/e-invite-pricing'
import { buildEInviteImagePrompt } from '@/lib/e-invite-prompt'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'
import { buildGifFromPngBuffers } from '@/lib/e-invite-gif'
import { buildMp4FromPngBuffers } from '@/lib/e-invite-video'
import { mastra } from '@/mastra'
import { MAX_EINVITE_ITERATIONS } from '@/lib/e-invite-constants'
import {
    generateVideoWithOpenRouter,
    openRouterImageUrlEntry,
    openRouterReferenceImageEntry,
    type OpenRouterVideoReferenceImage,
} from '@/lib/openrouter-video'
import { refineEInviteVideoPrompt } from '@/mastra/agents/video-generation-agent'

const BUCKET = 'ekatraa2025'

function normalizeCharacterImageRef(raw: unknown): string | null {
    const s = String(raw || '').trim()
    if (!s) return null
    if (s.startsWith('data:image/')) return s
    if (s.startsWith('http://') || s.startsWith('https://')) return s
    return null
}

async function imageRefToBuffer(ref: string): Promise<Buffer> {
    const r = String(ref || '').trim()
    if (!r) throw new Error('Empty image reference')
    if (r.startsWith('data:')) {
        const idx = r.indexOf('base64,')
        if (idx === -1) throw new Error('Invalid data URL')
        return Buffer.from(r.slice(idx + 7), 'base64')
    }
    const res = await fetch(r)
    if (!res.ok) throw new Error('Could not download generated image')
    return Buffer.from(await res.arrayBuffer())
}

type DesignBody = {
    color_theme?: string
    variation?: string
    font_style?: string
    sticker_pack?: string
}

type PromptChatMessage = { sender?: string; text?: string; role?: string; content?: string }

function compactChatHistory(input: unknown): string {
    if (!Array.isArray(input)) return ''
    const lines = (input as PromptChatMessage[])
        .slice(-8)
        .map((m) => {
            const role = String(m.sender || m.role || 'user').toLowerCase() === 'bot' ? 'assistant' : 'user'
            const text = String(m.text || m.content || '').trim()
            if (!text) return ''
            return `${role}: ${text}`
        })
        .filter(Boolean)
    return lines.join('\n')
}

async function enhancePromptWithMastra(args: {
    occasion: string
    userPrompt: string
    eventName: string
    hostNames: string
    eventDate: string
    eventTime: string
    venue: string
    chatHistory: string
    sessionId: string
}): Promise<string> {
    const prompt = `You are an image-prompt optimizer for high-quality Indian event invitation artwork.
Return ONLY one improved prompt (plain text). No markdown, no bullets.
Guardrails:
- Keep content family-friendly and culturally respectful.
- Focus on invitation design visuals only.
- Include key event details exactly when provided.
- Preserve user intent while improving clarity, composition, color harmony, typography cues, and print-ready aesthetics.

Event details:
- Occasion: ${args.occasion}
- Event name: ${args.eventName}
- Hosts: ${args.hostNames || 'N/A'}
- Date: ${args.eventDate || 'N/A'}
- Time: ${args.eventTime || 'N/A'}
- Venue: ${args.venue || 'N/A'}

User prompt:
${args.userPrompt}

Recent chat context:
${args.chatHistory || 'N/A'}`
    try {
        const agent = mastra.getAgentById('event-planning-agent')
        const runtime = await getAiRuntimeSettings()
        const out = await agent.generate(
            [{ role: 'user', content: prompt }],
            {
                model: mastraAgentModelForInvocation(runtime),
                memory: { thread: `e-invite-${args.sessionId}`, resource: 'ekatraa-einvite' },
            }
        )
        const text = String(out?.text || '').trim()
        return text || args.userPrompt
    } catch {
        return args.userPrompt
    }
}

export async function POST(req: Request) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const body = await req.json().catch(() => ({}))
        const occasion = String(body.occasion || 'Celebration').trim()
        const rawMedia = String(body.media_type || 'image').toLowerCase()
        const mediaKind: EInviteMediaKind = rawMedia === 'animated' ? 'animated' : 'static'
        const userPrompt = String(body.prompt || '').trim()
        const eventName = String(body.event_name || '').trim()
        if (!eventName) {
            return NextResponse.json({ error: 'event_name is required' }, { status: 400 })
        }
        if (!userPrompt) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
        }

        const hostNames = String(body.host_names || '').trim()
        const eventDate = String(body.event_date || '').trim()
        const eventTime = String(body.event_time || '').trim()
        const venue = String(body.venue || '').trim()

        const design: DesignBody =
            body.design && typeof body.design === 'object' ? (body.design as DesignBody) : {}
        const invitationTexts =
            body.invitation_texts && typeof body.invitation_texts === 'object'
                ? (body.invitation_texts as Record<string, unknown>)
                : null
        const preferredLanguage = String(body.preferred_language || 'en').trim().toLowerCase()
        const chatHistory = compactChatHistory(body.chat_history)

        const { data: counterRow } = await supabase
            .from('user_e_invite_generation_counters')
            .select('total_generations')
            .eq('user_id', userId)
            .maybeSingle()
        const { count: existingCount } = await supabase
            .from('user_e_invites')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
        const usedIterations = Number(counterRow?.total_generations ?? existingCount ?? 0)
        if (usedIterations >= MAX_EINVITE_ITERATIONS) {
            return NextResponse.json(
                {
                    error: `Generation limit reached. Max ${MAX_EINVITE_ITERATIONS} invites are allowed.`,
                    code: 'ITERATION_LIMIT_REACHED',
                    max_iterations: MAX_EINVITE_ITERATIONS,
                    used_iterations: usedIterations,
                    remaining_iterations: 0,
                },
                { status: 429 }
            )
        }

        const settings = await getAiRuntimeSettings()
        const imageModel = settings.openrouterImageModel

        const sessionId = `e-inv-gen-${userId}-${Date.now()}`
        const refinedPrompt = await enhancePromptWithMastra({
            occasion,
            userPrompt,
            eventName,
            hostNames,
            eventDate,
            eventTime,
            venue,
            chatHistory,
            sessionId,
        })

        const baseArgs = {
            occasion,
            userPrompt: refinedPrompt,
            eventName,
            hostNames: hostNames || undefined,
            eventDate: eventDate || undefined,
            eventTime: eventTime || undefined,
            venue: venue || undefined,
            design,
        }

        let storagePath: string
        let uploadBody: Buffer
        let contentType: string
        let outputMime: string
        let apiCostUsd: number | null = null
        let openrouterCostUsd: number | null = null
        let videoGenerationModel: string | null = null

        const brideImage = normalizeCharacterImageRef(body.bride_image)
        const groomImage = normalizeCharacterImageRef(body.groom_image)
        const mainCharacterImage = normalizeCharacterImageRef(body.main_character_image)
        const hasCharacterImages = Boolean(brideImage || groomImage || mainCharacterImage)

        if (mediaKind === 'static') {
            const prompt = buildEInviteImagePrompt({
                ...baseArgs,
                compositionHint:
                    'Single static frame — rich shadows, subtle paper texture, magazine finish. Frozen typography; no motion artifacts.',
            })
            const { imageRef } = await generateImageWithOpenRouter({
                model: imageModel,
                prompt,
                sessionId,
            })
            uploadBody = await imageRefToBuffer(imageRef)
            contentType = 'image/png'
            storagePath = `e-invites/${userId}/${randomUUID()}.png`
            outputMime = 'image/png'
        } else if (hasCharacterImages) {
            const characterParts: string[] = []
            if (brideImage) characterParts.push('bride portrait reference')
            if (groomImage) characterParts.push('groom portrait reference')
            if (mainCharacterImage) characterParts.push('main character portrait reference')

            const videoAgent = mastra.getAgentById('video-generation-agent')
            const videoPrompt = await refineEInviteVideoPrompt({
                agent: videoAgent,
                occasion,
                eventName,
                hostNames: hostNames || undefined,
                eventDate: eventDate || undefined,
                venue: venue || undefined,
                userPrompt: refinedPrompt,
                characterHint: characterParts.join(', '),
                memoryThread: `e-invite-video-${sessionId}`,
            })

            const frameImages = mainCharacterImage
                ? [openRouterImageUrlEntry(mainCharacterImage, 'first_frame')]
                : brideImage
                  ? [openRouterImageUrlEntry(brideImage, 'first_frame')]
                  : groomImage
                    ? [openRouterImageUrlEntry(groomImage, 'first_frame')]
                    : undefined

            const referenceImages: OpenRouterVideoReferenceImage[] = []
            if (mainCharacterImage) {
                if (brideImage) referenceImages.push(openRouterReferenceImageEntry(brideImage))
                if (groomImage) referenceImages.push(openRouterReferenceImageEntry(groomImage))
            } else if (brideImage && groomImage) {
                referenceImages.push(openRouterReferenceImageEntry(groomImage))
            }

            const videoModel = settings.openrouterInviteAnimatedModel
            const videoResult = await generateVideoWithOpenRouter({
                model: videoModel,
                prompt: videoPrompt,
                aspect_ratio: '9:16',
                resolution: '720p',
                duration: 5,
                generate_audio: false,
                frame_images: frameImages,
                input_references: referenceImages.length ? referenceImages : undefined,
                pollIntervalMs: 15000,
                maxPollAttempts: 48,
            })

            uploadBody = videoResult.videoBuffer
            contentType = videoResult.contentType || 'video/mp4'
            storagePath = `e-invites/${userId}/${randomUUID()}.mp4`
            outputMime = 'video/mp4'
            apiCostUsd = videoResult.costUsd
            openrouterCostUsd = videoResult.costUsd
            videoGenerationModel = videoResult.model
        } else {
            const prompt1 = buildEInviteImagePrompt({
                ...baseArgs,
                compositionHint:
                    'Frozen invitation artwork — a single still moment. Typography razor-sharp and fully readable: no glow, no motion blur, no double-exposure, no strobe, no “shimmer” on letters.',
            })
            const prompt2 = buildEInviteImagePrompt({
                ...baseArgs,
                compositionHint:
                    'Companion frame for a subtle motion loop: reproduce the SAME invitation as the companion frame — identical wording, fonts, sizes, positions, and ink colors. Adjust ONLY soft background ambience behind the type (paper sheen, mandala watermark depth, corner motif lighting, gentle bokeh). Do NOT restyle typography, do NOT add effects on text, no flicker.',
            })

            const [{ imageRef: ref1 }, { imageRef: ref2 }] = await Promise.all([
                generateImageWithOpenRouter({ model: imageModel, prompt: prompt1, sessionId }),
                generateImageWithOpenRouter({ model: imageModel, prompt: prompt2, sessionId }),
            ])
            const buf1 = await imageRefToBuffer(ref1)
            const buf2 = await imageRefToBuffer(ref2)
            try {
                uploadBody = await buildMp4FromPngBuffers([buf1, buf2])
                contentType = 'video/mp4'
                storagePath = `e-invites/${userId}/${randomUUID()}.mp4`
                outputMime = 'video/mp4'
            } catch {
                uploadBody = await buildGifFromPngBuffers([buf1, buf2])
                contentType = 'image/gif'
                storagePath = `e-invites/${userId}/${randomUUID()}.gif`
                outputMime = 'image/gif'
            }
        }

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, uploadBody, {
            contentType,
            upsert: false,
        })
        if (upErr) {
            return NextResponse.json({ error: upErr.message || 'Storage upload failed' }, { status: 500 })
        }

        const priceInr = await priceInrForMediaKind(mediaKind)
        const combinedPrompt = buildEInviteImagePrompt({
            ...baseArgs,
        })

        const formPayload = {
            occasion,
            media_type: rawMedia,
            output_mime: outputMime,
            event_name: eventName,
            host_names: hostNames,
            event_date: eventDate,
            event_time: eventTime,
            venue,
            design,
            prompt: userPrompt,
            invitation_texts: invitationTexts,
            preferred_language: preferredLanguage,
            chat_history: chatHistory,
            prompt_refined: refinedPrompt,
            bride_image: brideImage ? '[provided]' : undefined,
            groom_image: groomImage ? '[provided]' : undefined,
            main_character_image: mainCharacterImage ? '[provided]' : undefined,
            api_cost_usd: apiCostUsd,
            openrouter_cost_usd: openrouterCostUsd,
            video_model: videoGenerationModel,
        }

        const { data: row, error: insErr } = await supabase
            .from('user_e_invites')
            .insert({
                user_id: userId,
                media_kind: mediaKind,
                storage_path: storagePath,
                price_inr: priceInr,
                payment_status: 'unpaid',
                prompt: combinedPrompt,
                form_payload: formPayload,
            })
            .select('id, payment_status, price_inr, media_kind')
            .single()

        if (insErr || !row) {
            return NextResponse.json({ error: insErr?.message || 'Could not save invite record' }, { status: 500 })
        }
        await supabase.from('user_e_invite_generation_counters').upsert(
            {
                user_id: userId,
                total_generations: usedIterations + 1,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id', ignoreDuplicates: false }
        )

        const mediaUrl = await signedUrlForStorageRef(storagePath)

        return NextResponse.json({
            user_e_invite_id: row.id,
            media_url: mediaUrl,
            storage_path: storagePath,
            output_mime: outputMime,
            payment_status: row.payment_status,
            price_inr: row.price_inr,
            media_kind: row.media_kind,
            prompt: combinedPrompt,
            max_iterations: MAX_EINVITE_ITERATIONS,
            used_iterations: usedIterations + 1,
            remaining_iterations: Math.max(0, MAX_EINVITE_ITERATIONS - (usedIterations + 1)),
            estimated_seconds: mediaKind === 'animated' ? (hasCharacterImages ? 180 : 130) : 80,
            api_cost_usd: apiCostUsd,
            openrouter_cost_usd: openrouterCostUsd,
            video_model: videoGenerationModel,
        })
    } catch (e) {
        const msg = (e as Error)?.message || String(e)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
