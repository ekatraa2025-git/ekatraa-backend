import { createTool } from '@mastra/core/tools'
import { supabase } from '@/lib/supabase/server'
import { getRecommendationsCore } from '@/lib/recommendations-core'
import { z } from 'zod'

export const getRecommendationsTool = createTool({
    id: 'get_recommendations',
    description:
        'Compute budget allocation and eligible offerable services for an occasion and total INR budget.',
    inputSchema: z.object({
        occasion_id: z.string().describe('Occasion UUID'),
        budget_inr: z.number().positive().describe('Total planned budget in INR'),
    }),
    execute: async (input) => {
        const result = await getRecommendationsCore(supabase, {
            occasionId: input.occasion_id,
            totalBudgetInr: input.budget_inr,
            categoryWeights: null,
        })
        if (!result.ok) {
            return { error: result.message, status: result.status }
        }
        return {
            occasion_id: result.occasion_id,
            occasion_name: result.occasion_name,
            total_budget: result.total_budget,
            allocation_summary: result.allocation_summary,
            categories: result.categories,
        }
    },
})
