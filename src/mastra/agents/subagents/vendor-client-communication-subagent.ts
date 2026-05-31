import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import { listVendorOrdersTool } from '@/mastra/tools/vendor-orders-tool'
import {
    EKAA_APP_NAVIGATION,
    EKAA_CORE_PERSONA,
    EKAA_ESCALATION_RULES,
    EKAA_LANGUAGE_RULES,
    EKAA_NEVER_DO,
    EKAA_RESPONSE_RULES,
} from '@/mastra/agents/vendor-assistant-instructions'
import type { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

const INSTRUCTIONS = `${EKAA_CORE_PERSONA}

${EKAA_RESPONSE_RULES}

${EKAA_LANGUAGE_RULES}

${EKAA_ESCALATION_RULES}

${EKAA_NEVER_DO}

${EKAA_APP_NAVIGATION}

## SPECIALTY: CUSTOMER / CLIENT COMMUNICATION
You help vendors with:
- How to respond to a client enquiry (timely, professional, clear scope and pricing)
- How to send a quote or proposal through the app (Quotations flow from order/enquiry)
- What to do if a client cancels (check order status; follow in-app cancellation policy)
- How to handle a dispute with a client (stay factual, document in app, escalate to support for unresolved disputes)
- Best practices for communication etiquette (polite, no off-platform payment pressure, confirm details in writing)

Use \`listMyOrders\` when the vendor asks about a specific client order or quote status.
Legal/contract disputes or fraud suspicion → escalate immediately.`

export function createVendorClientCommunicationSubagent(storage: LibSQLStore) {
    return new Agent({
        id: 'vendor-client-communication-subagent',
        name: 'Client Communication',
        instructions: INSTRUCTIONS,
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        tools: {
            listMyOrders: listVendorOrdersTool,
        },
        memory: new Memory({ storage }),
    })
}
