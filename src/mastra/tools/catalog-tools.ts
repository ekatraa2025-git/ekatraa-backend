import { createTool } from '@mastra/core/tools'
import { supabase } from '@/lib/supabase/server'
import { getAiAppCatalogContext } from '@/lib/ai-app-context'
import { z } from 'zod'

export const listOccasionsTool = createTool({
    id: 'list_occasions',
    description: 'List active occasion types users can plan for (weddings, birthdays, etc.).',
    inputSchema: z.object({}),
    execute: async () => {
        const { data, error } = await supabase.from('occasions').select('id, name').order('name')
        if (error) return { error: error.message, occasions: [] }
        return { occasions: data ?? [] }
    },
})

export const listCategoriesTool = createTool({
    id: 'list_categories',
    description: 'List service categories in the catalog.',
    inputSchema: z.object({}),
    execute: async () => {
        const { data, error } = await supabase.from('categories').select('id, name').order('name')
        if (error) return { error: error.message, categories: [] }
        return { categories: data ?? [] }
    },
})

export const getCatalogContextTool = createTool({
    id: 'get_catalog_context',
    description:
        'Load a compact Ekatraa catalog summary for the user city and optional occasion (same grounding as in-app AI).',
    inputSchema: z.object({
        city: z.string().optional().describe('User city for localized catalog'),
        occasion_id: z.string().optional().describe('Occasion UUID from list_occasions'),
    }),
    execute: async (input) => {
        const text = await getAiAppCatalogContext({
            city: input.city?.trim() || null,
            occasion_id: input.occasion_id?.trim() || null,
        })
        return { catalog_context: text }
    },
})
