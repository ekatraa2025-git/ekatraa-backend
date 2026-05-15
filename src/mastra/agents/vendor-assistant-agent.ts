import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import { listVendorOrdersTool } from '@/mastra/tools/vendor-orders-tool'
import { Memory } from '@mastra/memory'
import type { LibSQLStore } from '@mastra/libsql'

const VENDOR_INSTRUCTIONS = `You are Ekatraa Vendor Assistant. Help vendors understand their orders and next steps.
- Only use list_my_orders — it is scoped to the authenticated vendor server-side. Never ask the model to "switch" vendor.
- Keep answers concise and operational. No legal advice.
- If voice mode is mentioned in system context, respond in short plain sentences suitable for speech playback.`

export function createVendorAssistantAgent(storage: LibSQLStore) {
    return new Agent({
        id: 'vendor-assistant-agent',
        name: 'Ekatraa Vendor Assistant',
        instructions: VENDOR_INSTRUCTIONS,
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        tools: {
            listMyOrders: listVendorOrdersTool,
        },
        memory: new Memory({
            storage,
        }),
    })
}
