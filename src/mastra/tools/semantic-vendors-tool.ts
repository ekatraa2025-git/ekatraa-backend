import { createTool } from '@mastra/core/tools'
import { supabase } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Calls RPC match_offerable_services_semantic when migration 044 is applied.
 * Returns empty matches if RPC/table missing (graceful).
 */
export const matchOfferableServicesSemanticTool = createTool({
    id: 'match_offerable_services_semantic',
    description:
        'Semantic search over embedded offerable services (1536-d vectors). Pass query_embedding as 1536 floats.',
    inputSchema: z.object({
        query_embedding: z.array(z.number()),
        match_count: z.number().int().min(1).max(50).optional(),
    }),
    execute: async (input) => {
        if (input.query_embedding.length !== 1536) {
            return {
                matches: [],
                note: 'query_embedding must be exactly 1536 dimensions (e.g. text-embedding-3-large).',
            }
        }
        const matchCount = input.match_count ?? 8
        const { data, error } = await supabase.rpc('match_offerable_services_semantic', {
            query_embedding: input.query_embedding,
            match_count: matchCount,
        })
        if (error) {
            return {
                matches: [] as unknown[],
                note: error.message.includes('function') ? 'Semantic RPC not deployed yet.' : error.message,
            }
        }
        return { matches: data ?? [] }
    },
})
