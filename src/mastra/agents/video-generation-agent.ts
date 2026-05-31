import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import type { LibSQLStore } from '@mastra/libsql'

const VIDEO_INSTRUCTIONS = `You are Ekatraa E-Invite Video Director for Indian celebrations (wedding, birthday, anniversary, puja, corporate, etc.).
- Output ONLY a single video generation prompt (plain text, no markdown).
- The prompt must describe cinematic motion, lighting, and festive atmosphere suitable for a vertical 9:16 invitation reel.
- When bride/groom or main character reference images are provided, describe respectful likeness preservation and elegant portrait-to-scene animation.
- Keep typography areas stable; animate background ambience, soft particles, light bokeh, garlands, or mandap glow — not unreadable text morphing.
- Family-friendly, culturally respectful, premium editorial look.
- Include occasion name and key event details when supplied.`

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
