import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import { listCategoriesTool, listOccasionsTool, getCatalogContextTool } from '@/mastra/tools/catalog-tools'
import { getRecommendationsTool } from '@/mastra/tools/recommendations-tool'
import { getVendorsPreviewTool } from '@/mastra/tools/vendors-preview-tool'
import { matchOfferableServicesSemanticTool } from '@/mastra/tools/semantic-vendors-tool'
import type { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

const INSTRUCTIONS = `You are the Ekatraa catalog & recommendations specialist.
- Use tools for occasions, categories, catalog context, budget recommendations, vendor previews, and semantic service matching.
- Never invent prices, vendor names, or service IDs.
- Return concise markdown the orchestrator can show to the user.`

export function createCatalogPlanningSubagent(storage: LibSQLStore) {
    return new Agent({
        id: 'catalog-planning-subagent',
        name: 'Catalog & Recommendations',
        instructions: INSTRUCTIONS,
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        tools: {
            listOccasions: listOccasionsTool,
            listCategories: listCategoriesTool,
            getCatalogContext: getCatalogContextTool,
            getRecommendations: getRecommendationsTool,
            getVendorsPreview: getVendorsPreviewTool,
            matchOfferableServicesSemantic: matchOfferableServicesSemanticTool,
        },
        memory: new Memory({ storage }),
    })
}
