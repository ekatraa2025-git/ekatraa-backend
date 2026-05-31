import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import { listVendorOrdersTool } from '@/mastra/tools/vendor-orders-tool'
import { buildEkaaOrchestratorInstructions } from '@/mastra/agents/vendor-assistant-instructions'
import { createVendorBookingCalendarSubagent } from '@/mastra/agents/subagents/vendor-booking-calendar-subagent'
import { createVendorPaymentBillingSubagent } from '@/mastra/agents/subagents/vendor-payment-billing-subagent'
import { createVendorAppUsageSubagent } from '@/mastra/agents/subagents/vendor-app-usage-subagent'
import { createVendorProfileListingSubagent } from '@/mastra/agents/subagents/vendor-profile-listing-subagent'
import { createVendorClientCommunicationSubagent } from '@/mastra/agents/subagents/vendor-client-communication-subagent'
import {
    buildVendorAssistantHarnessSubagents,
    createDelegateVendorSubagentTool,
} from '@/mastra/harness/vendor-assistant-harness'
import { Memory } from '@mastra/memory'
import type { LibSQLStore } from '@mastra/libsql'

/** Subagent harness registry (for observability / Studio). */
export const vendorAssistantHarnessSubagents = buildVendorAssistantHarnessSubagents()

export function createVendorAssistantAgent(storage: LibSQLStore) {
    const bookingCalendar = createVendorBookingCalendarSubagent(storage)
    const paymentBilling = createVendorPaymentBillingSubagent(storage)
    const appUsage = createVendorAppUsageSubagent(storage)
    const profileListing = createVendorProfileListingSubagent(storage)
    const clientCommunication = createVendorClientCommunicationSubagent(storage)

    const subagentMap = {
        booking_calendar: bookingCalendar,
        payment_billing: paymentBilling,
        app_usage: appUsage,
        profile_listing: profileListing,
        client_communication: clientCommunication,
    }

    return new Agent({
        id: 'vendor-assistant-agent',
        name: 'Ekaa — Ekatraa Vendor Assistant',
        instructions: buildEkaaOrchestratorInstructions(),
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        agents: {
            bookingCalendar,
            paymentBilling,
            appUsage,
            profileListing,
            clientCommunication,
        },
        tools: {
            listMyOrders: listVendorOrdersTool,
            delegateVendorSubagent: createDelegateVendorSubagentTool(subagentMap),
        },
        memory: new Memory({
            storage,
        }),
    })
}
