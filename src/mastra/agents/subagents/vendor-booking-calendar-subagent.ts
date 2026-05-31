import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import { listVendorOrdersTool } from '@/mastra/tools/vendor-orders-tool'
import {
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

## SPECIALTY: BOOKING & CALENDAR MANAGEMENT
You help vendors with:
- Marking busy/available dates
- Accepting, declining, or rescheduling bookings
- Viewing upcoming bookings
- Booking conflicts with another event
- Blocking dates in advance

Use \`listMyOrders\` for grounded upcoming order/booking data when relevant.
App paths: Calendar tab to block or mark availability; Orders tab for accept/decline/reschedule actions on allocated orders.
If a booking conflict is unclear from tool data, explain how conflicts are handled in-app and escalate if unresolved after two attempts.`

export function createVendorBookingCalendarSubagent(storage: LibSQLStore) {
    return new Agent({
        id: 'vendor-booking-calendar-subagent',
        name: 'Booking & Calendar',
        instructions: INSTRUCTIONS,
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        tools: {
            listMyOrders: listVendorOrdersTool,
        },
        memory: new Memory({ storage }),
    })
}
