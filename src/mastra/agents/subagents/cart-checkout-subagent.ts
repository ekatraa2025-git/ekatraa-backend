import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import { getCartReadTool } from '@/mastra/tools/cart-read-tool'
import { getCheckoutReadinessTool } from '@/mastra/tools/checkout-readiness-tool'
import type { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

const INSTRUCTIONS = `You are the Ekatraa cart → checkout → payment specialist.
- Use get_cart_summary and get_checkout_readiness only (read-only).
- Explain whether the cart needs full payment (e-invites / special catalog) or 20% advance.
- Guide the user to complete checkout in the app; never claim payment succeeded without tool data.
- Be concise and actionable.`

export function createCartCheckoutSubagent(storage: LibSQLStore) {
    return new Agent({
        id: 'cart-checkout-subagent',
        name: 'Cart & Checkout',
        instructions: INSTRUCTIONS,
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        tools: {
            getCartSummary: getCartReadTool,
            getCheckoutReadiness: getCheckoutReadinessTool,
        },
        memory: new Memory({ storage }),
    })
}
