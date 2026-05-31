import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import { getUserOrdersContextTool } from '@/mastra/tools/order-context-tool'
import { getVendorsPreviewTool } from '@/mastra/tools/vendors-preview-tool'
import type { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

const INSTRUCTIONS = `You are the Ekatraa order & vendor allocation specialist.
- Use get_user_orders_context for the signed-in customer's orders, item-level vendor allocations, and accepted quotes.
- Use get_vendors_preview when suggesting vendors for an occasion/budget.
- Ground all vendor and order status answers in tool output.
- Help the user understand who is allocated, quote acceptance, and next steps.`

export function createOrderAllocationSubagent(storage: LibSQLStore) {
    return new Agent({
        id: 'order-allocation-subagent',
        name: 'Orders & Allocations',
        instructions: INSTRUCTIONS,
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        tools: {
            getUserOrdersContext: getUserOrdersContextTool,
            getVendorsPreview: getVendorsPreviewTool,
        },
        memory: new Memory({ storage }),
    })
}
