import { createTool } from '@mastra/core/tools'
import type { HarnessSubagent } from '@mastra/core/harness'
import { z } from 'zod'
import type { Agent } from '@mastra/core/agent'

export const VENDOR_ASSISTANT_SUBAGENT_IDS = [
    'booking_calendar',
    'payment_billing',
    'app_usage',
    'profile_listing',
    'client_communication',
] as const

export type VendorAssistantSubagentId = (typeof VENDOR_ASSISTANT_SUBAGENT_IDS)[number]

/** Harness-style subagent registry for Ekaa vendor assistant. */
export function buildVendorAssistantHarnessSubagents(): HarnessSubagent[] {
    return [
        {
            id: 'booking_calendar',
            name: 'Booking & Calendar',
            description:
                'Busy/available dates, accept/decline/reschedule bookings, upcoming bookings, conflicts, blocking dates.',
            instructions: `Specialist for vendor calendar and booking management. Use listMyOrders when order facts are needed.`,
            allowedHarnessTools: ['listMyOrders'],
        },
        {
            id: 'payment_billing',
            name: 'Payment & Billing',
            description: 'Payout timing, disputes, commission/fees, bank/UPI updates, GST and invoices.',
            instructions: `Specialist for vendor payments and billing. Never invent payout timelines or fee percentages.`,
            allowedHarnessTools: ['listMyOrders'],
        },
        {
            id: 'app_usage',
            name: 'App Usage & How-To',
            description: 'Step-by-step app guidance, navigation, login/OTP/crash troubleshooting.',
            instructions: `Specialist for Ekatraa vendor app how-to and troubleshooting. No write tools.`,
            allowedHarnessTools: [],
        },
        {
            id: 'profile_listing',
            name: 'Profile & Listing',
            description: 'Photos, packages, profile copy, pricing, verification, listing visibility.',
            instructions: `Specialist for vendor profile and listing setup. Guide through app screens only.`,
            allowedHarnessTools: [],
        },
        {
            id: 'client_communication',
            name: 'Client Communication',
            description: 'Enquiries, quotes/proposals, cancellations, disputes, communication etiquette.',
            instructions: `Specialist for vendor–client communication via the app. Escalate legal/fraud disputes.`,
            allowedHarnessTools: ['listMyOrders'],
        },
    ]
}

export function createDelegateVendorSubagentTool(agents: Record<VendorAssistantSubagentId, Agent>) {
    return createTool({
        id: 'delegate_vendor_subagent',
        description:
            'Delegate a focused task to a vendor sub-agent: booking_calendar, payment_billing, app_usage, profile_listing, or client_communication. Pass a clear task string.',
        inputSchema: z.object({
            subagent: z.enum(VENDOR_ASSISTANT_SUBAGENT_IDS),
            task: z.string().min(1).max(4000),
        }),
        execute: async (input, context) => {
            const agent = agents[input.subagent]
            if (!agent) {
                return { error: `Unknown subagent: ${input.subagent}` }
            }
            const rc = context?.requestContext
            try {
                const out = await agent.generate([{ role: 'user', content: input.task }], {
                    requestContext: rc,
                })
                return {
                    subagent: input.subagent,
                    reply: out.text?.trim() || '',
                }
            } catch (e) {
                return { error: (e as Error).message, subagent: input.subagent }
            }
        },
    })
}
