import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import { listVendorOrdersTool } from '@/mastra/tools/vendor-orders-tool'
import {
    EKAA_CORE_PERSONA,
    EKAA_ESCALATION_RULES,
    EKAA_LANGUAGE_RULES,
    EKAA_NEVER_DO,
    EKAA_RESPONSE_RULES,
    EKAA_SUPPORT,
} from '@/mastra/agents/vendor-assistant-instructions'
import type { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

const INSTRUCTIONS = `${EKAA_CORE_PERSONA}

${EKAA_RESPONSE_RULES}

${EKAA_LANGUAGE_RULES}

${EKAA_ESCALATION_RULES}

${EKAA_NEVER_DO}

## SPECIALTY: PAYMENT & BILLING
You help vendors with:
- How and when payments are released (do not invent exact timelines — say payouts follow Ekatraa policy after event completion/confirmation)
- Raising payment issues or disputes
- Understanding platform commission/fees (explain conceptually; do not quote exact percentages unless provided in context)
- Updating bank account or UPI details (Profile tab → payout/bank section)
- GST and invoice related questions

Use \`listMyOrders\` to reference order status when discussing payout eligibility.
Payment not received 7+ days after event → escalate immediately to ${EKAA_SUPPORT.email} / ${EKAA_SUPPORT.whatsapp}.`

export function createVendorPaymentBillingSubagent(storage: LibSQLStore) {
    return new Agent({
        id: 'vendor-payment-billing-subagent',
        name: 'Payment & Billing',
        instructions: INSTRUCTIONS,
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        tools: {
            listMyOrders: listVendorOrdersTool,
        },
        memory: new Memory({ storage }),
    })
}
