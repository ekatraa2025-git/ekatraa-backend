import { createTool } from '@mastra/core/tools'
import type { HarnessSubagent } from '@mastra/core/harness'
import { z } from 'zod'
import type { Agent } from '@mastra/core/agent'

export const EVENT_PLANNING_SUBAGENT_IDS = ['catalog', 'cart_checkout', 'order_allocation'] as const
export type EventPlanningSubagentId = (typeof EVENT_PLANNING_SUBAGENT_IDS)[number]

/** Harness-style subagent registry (tool-scoped instructions + allowed tool ids). */
export function buildEventPlanningHarnessSubagents(): HarnessSubagent[] {
    return [
        {
            id: 'catalog',
            name: 'Catalog & Recommendations',
            description: 'Occasions, categories, budget recommendations, vendor previews, semantic service match.',
            instructions: `Specialist for catalog discovery and budget-aware recommendations. Use harness tools only.`,
            allowedHarnessTools: [
                'listOccasions',
                'listCategories',
                'getCatalogContext',
                'getRecommendations',
                'getVendorsPreview',
                'matchOfferableServicesSemantic',
            ],
        },
        {
            id: 'cart_checkout',
            name: 'Cart & Checkout',
            description: 'Read cart lines and checkout/payment readiness (advance vs full pay).',
            instructions: `Specialist for cart summary and checkout readiness. Read-only; guide user to app checkout.`,
            allowedHarnessTools: ['getCartSummary', 'getCheckoutReadiness'],
        },
        {
            id: 'order_allocation',
            name: 'Orders & Allocations',
            description: 'User orders, vendor allocations per line item, accepted quotations.',
            instructions: `Specialist for post-booking order status and vendor allocations. Requires signed-in user.`,
            allowedHarnessTools: ['getUserOrdersContext', 'getVendorsPreview'],
        },
    ]
}

export function createDelegatePlanningSubagentTool(agents: Record<EventPlanningSubagentId, Agent>) {
    return createTool({
        id: 'delegate_planning_subagent',
        description:
            'Delegate a focused task to a planning sub-agent: catalog (discovery/recommendations), cart_checkout (cart→payment), or order_allocation (orders/vendor allocations). Pass a clear task string.',
        inputSchema: z.object({
            subagent: z.enum(EVENT_PLANNING_SUBAGENT_IDS),
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
