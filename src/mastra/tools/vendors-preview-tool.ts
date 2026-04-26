import { createTool } from '@mastra/core/tools'
import { supabase } from '@/lib/supabase/server'
import { getVendorsPreviewCore } from '@/lib/vendors-preview-core'
import { z } from 'zod'

export const getVendorsPreviewTool = createTool({
    id: 'get_vendors_preview',
    description:
        'List redacted vendor discovery cards for a city and optional occasion (no direct contact details).',
    inputSchema: z.object({
        city: z.string().optional(),
        occasion_id: z.string().optional(),
        limit: z.number().int().min(1).max(30).optional(),
    }),
    execute: async (input) => {
        const result = await getVendorsPreviewCore(supabase, {
            city: input.city ?? null,
            occasionId: input.occasion_id ?? null,
            limit: input.limit,
        })
        if (!result.ok) return { error: result.message, vendors: [] }
        return { vendors: result.data }
    },
})
