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
import { MAX_EINVITE_ITERATIONS, MAX_EINVITE_DESIGN_REDESIGNS, E_INVITE_VIDEO_DURATION_SEC } from '@/lib/e-invite-constants'
import {
    generateVideoWithOpenRouter,
    openRouterImageUrlEntry,
    openRouterReferenceImageEntry,
    pickInviteVideoDurationSec,
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
        const isRedesignEarly = body.redesign === true
        if (!isRedesignEarly && !eventName) {
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

        const isRedesign = body.redesign === true
        const redesignInviteId = String(body.user_e_invite_id || '').trim()

        let existingInviteRow: {
            id: string
            media_kind: string
            form_payload: Record<string, unknown>
            storage_path: string
            payment_status: string
            price_inr: number
        } | null = null
        let redesignCount = 0

        if (isRedesign) {
            if (!redesignInviteId) {
                return NextResponse.json({ error: 'user_e_invite_id is required for redesign' }, { status: 400 })
            }
            if (!userPrompt) {
                return NextResponse.json(
                    { error: 'prompt is required — describe the design change in chat' },
                    { status: 400 }
                )
            }
            const { data: existing, error: existingErr } = await supabase
                .from('user_e_invites')
                .select('id, user_id, media_kind, form_payload, storage_path, payment_status, price_inr')
                .eq('id', redesignInviteId)
                .maybeSingle()
            if (existingErr || !existing || existing.user_id !== userId) {
                return NextResponse.json({ error: 'E-invite not found' }, { status: 404 })
            }
            const fp =
                existing.form_payload && typeof existing.form_payload === 'object' && !Array.isArray(existing.form_payload)
                    ? (existing.form_payload as Record<string, unknown>)
                    : {}
            redesignCount = Number(fp.design_redesign_count || 0)
            if (redesignCount >= MAX_EINVITE_DESIGN_REDESIGNS) {
                return NextResponse.json(
                    {
                        error: `Design redesign limit reached. Max ${MAX_EINVITE_DESIGN_REDESIGNS} chat refinements per invite.`,
                        code: 'DESIGN_REDESIGN_LIMIT_REACHED',
                        max_design_redesigns: MAX_EINVITE_DESIGN_REDESIGNS,
                        used_design_redesigns: redesignCount,
                        remaining_design_redesigns: 0,
                    },
                    { status: 429 }
                )
            }
            existingInviteRow = {
                id: String(existing.id),
                media_kind: String(existing.media_kind || 'static'),
                form_payload: fp,
                storage_path: String(existing.storage_path || ''),
                payment_status: String(existing.payment_status || 'unpaid'),
                price_inr: Number(existing.price_inr || 0),
            }
        }

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
        if (!isRedesign && usedIterations >= MAX_EINVITE_ITERATIONS) {
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

        const existingPayload = existingInviteRow?.form_payload ?? {}
        const resolvedOccasion =
            occasion ||
            (typeof existingPayload.occasion === 'string' ? existingPayload.occasion : '') ||
            'Celebration'
        const resolvedEventName =
            eventName ||
            (typeof existingPayload.event_name === 'string' ? existingPayload.event_name : '') ||
            (typeof existingPayload.eventName === 'string' ? existingPayload.eventName : '')
        const resolvedMediaKind: EInviteMediaKind =
            isRedesign && existingInviteRow
                ? existingInviteRow.media_kind === 'animated'
                    ? 'animated'
                    : 'static'
                : mediaKind
        const resolvedRawMedia = resolvedMediaKind === 'animated' ? 'animated' : 'image'

        if (!resolvedEventName) {
            return NextResponse.json({ error: 'event_name is required' }, { status: 400 })
        }

        const resolvedHostNames =
            hostNames ||
            (typeof existingPayload.host_names === 'string' ? existingPayload.host_names : '') ||
            ''
        const resolvedEventDate =
            eventDate ||
            (typeof existingPayload.event_date === 'string' ? existingPayload.event_date : '') ||
            ''
        const resolvedEventTime =
            eventTime ||
            (typeof existingPayload.event_time === 'string' ? existingPayload.event_time : '') ||
            ''
        const resolvedVenue =
            venue ||
            (typeof existingPayload.venue === 'string' ? existingPayload.venue : '') ||
            ''
        const resolvedDesign: DesignBody =
            Object.keys(design).length > 0
                ? design
                : existingPayload.design && typeof existingPayload.design === 'object' && !Array.isArray(existingPayload.design)
                  ? (existingPayload.design as DesignBody)
                  : {}

        const settings = await getAiRuntimeSettings()
        const imageModel = settings.openrouterImageModel

        const sessionId = `e-inv-gen-${userId}-${Date.now()}`
        const refinedPrompt = await enhancePromptWithMastra({
            occasion: resolvedOccasion,
            userPrompt,
            eventName: resolvedEventName,
            hostNames: resolvedHostNames,
            eventDate: resolvedEventDate,
            eventTime: resolvedEventTime,
            venue: resolvedVenue,
            chatHistory,
            sessionId,
        })

        const baseArgs = {
            occasion: resolvedOccasion,
            userPrompt: refinedPrompt,
            eventName: resolvedEventName,
            hostNames: resolvedHostNames || undefined,
            eventDate: resolvedEventDate || undefined,
            eventTime: resolvedEventTime || undefined,
            venue: resolvedVenue || undefined,
            design: resolvedDesign,
        }

        let storagePath: string
        let uploadBody: Buffer
        let contentType: string
        let outputMime: string
        let apiCostUsd: number | null = null
        let openrouterCostUsd: number | null = null
        let videoDurationSec: number | null = null
        let videoGenerationModel: string | null = null

        const brideImage = normalizeCharacterImageRef(body.bride_image)
        const groomImage = normalizeCharacterImageRef(body.groom_image)
        const mainCharacterImage = normalizeCharacterImageRef(body.main_character_image)
        const hasCharacterImages = Boolean(brideImage || groomImage || mainCharacterImage)

        if (resolvedMediaKind === 'static') {
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
                occasion: resolvedOccasion,
                eventName: resolvedEventName,
                hostNames: resolvedHostNames || undefined,
                eventDate: resolvedEventDate || undefined,
                venue: resolvedVenue || undefined,
                userPrompt: refinedPrompt,
                characterHint: characterParts.join(', '),
                memoryThread: `e-invite-video-${sessionId}`,
            })

            const frameImages = []
            if (mainCharacterImage) {
                frameImages.push(openRouterImageUrlEntry(mainCharacterImage, 'first_frame'))
            } else if (brideImage && groomImage) {
                frameImages.push(openRouterImageUrlEntry(brideImage, 'first_frame'))
                frameImages.push(openRouterImageUrlEntry(groomImage, 'last_frame'))
            } else if (brideImage) {
                frameImages.push(openRouterImageUrlEntry(brideImage, 'first_frame'))
            } else if (groomImage) {
                frameImages.push(openRouterImageUrlEntry(groomImage, 'first_frame'))
            }

            const referenceImages: OpenRouterVideoReferenceImage[] = []
            if (mainCharacterImage) {
                referenceImages.push(openRouterReferenceImageEntry(mainCharacterImage))
                if (brideImage && brideImage !== mainCharacterImage) {
                    referenceImages.push(openRouterReferenceImageEntry(brideImage))
                }
                if (groomImage && groomImage !== mainCharacterImage) {
                    referenceImages.push(openRouterReferenceImageEntry(groomImage))
                }
            } else {
                if (brideImage) referenceImages.push(openRouterReferenceImageEntry(brideImage))
                if (groomImage && groomImage !== brideImage) {
                    referenceImages.push(openRouterReferenceImageEntry(groomImage))
                }
            }

            const videoModel = settings.openrouterInviteAnimatedModel
            const envDuration = Number(process.env.OPENROUTER_INVITE_VIDEO_DURATION_SEC || E_INVITE_VIDEO_DURATION_SEC)
            videoDurationSec = pickInviteVideoDurationSec(videoModel, envDuration)
            const videoResult = await generateVideoWithOpenRouter({
                model: videoModel,
                prompt: videoPrompt,
                aspect_ratio: '9:16',
                resolution: '720p',
                duration: videoDurationSec,
                generate_audio: false,
                frame_images: frameImages.length ? frameImages : undefined,
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

        const priceInr = isRedesign && existingInviteRow
            ? Number(existingInviteRow.price_inr)
            : await priceInrForMediaKind(resolvedMediaKind)
        const combinedPrompt = buildEInviteImagePrompt({
            ...baseArgs,
        })

        const formPayload = {
            ...(existingPayload && typeof existingPayload === 'object' ? existingPayload : {}),
            occasion: resolvedOccasion,
            media_type: resolvedRawMedia,
            output_mime: outputMime,
            event_name: resolvedEventName,
            host_names: resolvedHostNames,
            event_date: resolvedEventDate,
            event_time: resolvedEventTime,
            venue: resolvedVenue,
            design: resolvedDesign,
            prompt: userPrompt,
            invitation_texts: invitationTexts ?? existingPayload.invitation_texts,
            preferred_language: preferredLanguage,
            chat_history: chatHistory,
            prompt_refined: refinedPrompt,
            bride_image: brideImage ? '[provided]' : existingPayload.bride_image,
            groom_image: groomImage ? '[provided]' : existingPayload.groom_image,
            main_character_image: mainCharacterImage ? '[provided]' : existingPayload.main_character_image,
            api_cost_usd: apiCostUsd ?? existingPayload.api_cost_usd,
            openrouter_cost_usd: openrouterCostUsd ?? existingPayload.openrouter_cost_usd,
            video_model: videoGenerationModel ?? existingPayload.video_model,
            video_duration_sec: videoDurationSec ?? existingPayload.video_duration_sec,
            design_redesign_count: isRedesign ? redesignCount + 1 : Number(existingPayload.design_redesign_count || 0),
        }

        let row: {
            id: string
            payment_status: string
            price_inr: number
            media_kind: string
        }

        if (isRedesign && existingInviteRow) {
            const { data: updated, error: updErr } = await supabase
                .from('user_e_invites')
                .update({
                    storage_path: storagePath,
                    prompt: combinedPrompt,
                    form_payload: formPayload,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existingInviteRow.id)
                .eq('user_id', userId)
                .select('id, payment_status, price_inr, media_kind')
                .single()

            if (updErr || !updated) {
                return NextResponse.json({ error: updErr?.message || 'Could not update invite record' }, { status: 500 })
            }
            row = updated
        } else {
            const { data: inserted, error: insErr } = await supabase
                .from('user_e_invites')
                .insert({
                    user_id: userId,
                    media_kind: resolvedMediaKind,
                    storage_path: storagePath,
                    price_inr: priceInr,
                    payment_status: 'unpaid',
                    prompt: combinedPrompt,
                    form_payload: formPayload,
                })
                .select('id, payment_status, price_inr, media_kind')
                .single()

            if (insErr || !inserted) {
                return NextResponse.json({ error: insErr?.message || 'Could not save invite record' }, { status: 500 })
            }
            row = inserted
            await supabase.from('user_e_invite_generation_counters').upsert(
                {
                    user_id: userId,
                    total_generations: usedIterations + 1,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id', ignoreDuplicates: false }
            )
        }

        const mediaUrl = await signedUrlForStorageRef(storagePath)

        const nextRedesignCount = Number(formPayload.design_redesign_count || 0)

        return NextResponse.json({
            user_e_invite_id: row.id,
            media_url: mediaUrl,
            storage_path: storagePath,
            output_mime: outputMime,
            payment_status: row.payment_status,
            price_inr: row.price_inr,
            media_kind: row.media_kind,
            prompt: combinedPrompt,
            redesign: isRedesign,
            max_iterations: MAX_EINVITE_ITERATIONS,
            used_iterations: isRedesign ? usedIterations : usedIterations + 1,
            remaining_iterations: isRedesign
                ? Math.max(0, MAX_EINVITE_ITERATIONS - usedIterations)
                : Math.max(0, MAX_EINVITE_ITERATIONS - (usedIterations + 1)),
            max_design_redesigns: MAX_EINVITE_DESIGN_REDESIGNS,
            used_design_redesigns: nextRedesignCount,
            remaining_design_redesigns: Math.max(0, MAX_EINVITE_DESIGN_REDESIGNS - nextRedesignCount),
            estimated_seconds: resolvedMediaKind === 'animated' ? (hasCharacterImages ? 180 : 130) : 80,
            api_cost_usd: apiCostUsd,
            openrouter_cost_usd: openrouterCostUsd,
            video_model: videoGenerationModel,
            video_duration_sec: videoDurationSec,
        })
    } catch (e) {
        const msg = (e as Error)?.message || String(e)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
