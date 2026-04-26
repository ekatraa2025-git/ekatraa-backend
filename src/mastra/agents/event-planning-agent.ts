import { Agent } from '@mastra/core/agent'
import { getMastraLlmModelString } from '@/lib/mastra-llm-model'
import { listCategoriesTool, listOccasionsTool, getCatalogContextTool } from '@/mastra/tools/catalog-tools'
import { getRecommendationsTool } from '@/mastra/tools/recommendations-tool'
import { getVendorsPreviewTool } from '@/mastra/tools/vendors-preview-tool'
import { getCartReadTool } from '@/mastra/tools/cart-read-tool'
import { matchOfferableServicesSemanticTool } from '@/mastra/tools/semantic-vendors-tool'
import { Memory } from '@mastra/memory'
import type { LibSQLStore } from '@mastra/libsql'

const PLANNING_INSTRUCTIONS = `You are Ekatraa AI for event planning in India, Odisha (weddings, birthdays, gatherings, Janeyu, Puja, Corporate Events, Funerals, etc.).
- Be warm, concise, and practical. Use tools to fetch real catalog data, recommendations, vendors, or cart state—never invent prices, vendor names, or guarantees.
- When the user shares a budget and occasion, prefer calling get_recommendations then get_vendors_preview for grounded suggestions.
- Encourage booking through the Ekatraa app for live packages. Do not give legal or medical advice.
- **Formatting (important for the app UI):** Use GitHub-Flavored Markdown. Separate ideas with **short paragraphs** and blank lines. For multiple services or next-step choices, use a **markdown bullet list** with one service or action per line (list items are tappable in the app). For **package tiers, pricing, or included items**, use a **markdown table** (columns such as Tier / Package, Price, Includes / notes) when comparing rows; each table row is tappable. Keep list items and table cell text scannable.`

export function createEventPlanningAgent(storage: LibSQLStore) {
    return new Agent({
        id: 'event-planning-agent',
        name: 'Ekatraa Event Planning',
        instructions: PLANNING_INSTRUCTIONS,
        model: getMastraLlmModelString(),
        tools: {
            listOccasions: listOccasionsTool,
            listCategories: listCategoriesTool,
            getCatalogContext: getCatalogContextTool,
            getRecommendations: getRecommendationsTool,
            getVendorsPreview: getVendorsPreviewTool,
            getCartSummary: getCartReadTool,
            matchOfferableServicesSemantic: matchOfferableServicesSemanticTool,
        },
        memory: new Memory({
            storage,
        }),
    })
}
