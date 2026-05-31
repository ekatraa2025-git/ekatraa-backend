import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { fetchUserOrderPlanningContext } from '@/lib/planning-order-context'

export const getUserOrdersContextTool = createTool({
    id: 'get_user_orders_context',
    description:
        'Read the authenticated user recent orders with line items, per-service vendor allocations, and accepted quotations. Use for checkout follow-ups, vendor status, and post-booking planning.',
    inputSchema: z.object({
        limit: z.number().int().min(1).max(10).optional().describe('Max orders to return (default 5)'),
    }),
    execute: async (input, context) => {
        const rc = context?.requestContext as { get?: (k: string) => unknown } | undefined
        const userId = (rc?.get?.('authenticatedUserId') as string | undefined | null) ?? null
        if (!userId) {
            return { error: 'Sign in required to read order context.', orders: [] }
        }
        const orders = await fetchUserOrderPlanningContext(userId, input.limit ?? 5)
        return { orders }
    },
})
