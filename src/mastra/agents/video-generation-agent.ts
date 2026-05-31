import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import type { LibSQLStore } from '@mastra/libsql'

const VIDEO_INSTRUCTIONS = `You are Ekatraa E-Invite Video Director for Indian celebrations (wedding, birthday, anniversary, puja, corporate, etc.).
- Output ONLY a single video generation prompt (plain text, no markdown).
- The prompt must describe a cinematic 4–6 second vertical 9:16 invitation reel: shallow depth of field, golden-hour or soft venue lighting, film grain, gentle camera dolly or slow push-in.
- When bride/groom or main character reference images are provided: characters walk gracefully into a realistic decorated venue (mandap, banquet lawn, heritage hall, or festive stage). Preserve respectful likeness; natural gait and subtle fabric motion; optional soft-focus guests or family in background bokeh.
- Join first/last frame references into one continuous scene: subjects move from portrait framing into the celebration space with coherent lighting and perspective.
- Keep invitation typography regions stable and readable; animate environment (petals, diyas, fairy lights, garlands, ambient haze) — never morph or blur text.
- Family-friendly, culturally respectful, premium editorial / Bollywood-invite aesthetic (not cartoon, not neon).
- Include occasion name and key event details when supplied.
- Duration feel: one polished cinematic beat (4–6 seconds), not a long trailer or a static slideshow.`

export function createVideoGenerationAgent(_storage: LibSQLStore) {
    return new Agent({
        id: 'video-generation-agent',
        name: 'Ekatraa Video Generation',
        instructions: VIDEO_INSTRUCTIONS,
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        tools: {},
    })
}

export async function refineEInviteVideoPrompt(args: {
    agent: Agent
    occasion: string
    eventName: string
    hostNames?: string
    eventDate?: string
    venue?: string
    userPrompt: string
    characterHint?: string
    memoryThread?: string
}): Promise<string> {
    const userContent = `Occasion: ${args.occasion}
Event: ${args.eventName}
Hosts: ${args.hostNames || 'N/A'}
Date: ${args.eventDate || 'N/A'}
Venue: ${args.venue || 'N/A'}
Character references: ${args.characterHint || 'none'}
Style / user notes:
${args.userPrompt}`

    try {
        const out = await args.agent.generate([{ role: 'user', content: userContent }], {
            ...(args.memoryThread
                ? { memory: { thread: args.memoryThread, resource: 'ekatraa-einvite-video' } }
                : {}),
        })
        const text = String(out?.text || '').trim()
        return text || args.userPrompt
    } catch {
        return args.userPrompt
    }
}
