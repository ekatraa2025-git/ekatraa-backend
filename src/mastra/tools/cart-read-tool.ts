import { createTool } from '@mastra/core/tools'
import { supabase } from '@/lib/supabase/server'
import { assertCartReadableByActor, getCartWithItems } from '@/lib/cart-read-core'
import { z } from 'zod'

export const getCartReadTool = createTool({
    id: 'get_cart_summary',
    description:
        'Read a shopping cart by UUID including line items and service names (read-only). Requires server-injected caller context (JWT cart owner or matching anonymous session from the mobile app); cross-user enumeration is forbidden.',
    inputSchema: z.object({
        cart_id: z.string().uuid().describe('Public cart id'),
    }),
    execute: async (input, context) => {
        const rc = context?.requestContext as { get?: (k: string) => unknown } | undefined
        const authenticatedUserId = (rc?.get?.('authenticatedUserId') as string | undefined | null) ?? null
        const trustedCartSessionId = (rc?.get?.('trustedCartSessionId') as string | undefined | null) ?? null

        const result = await getCartWithItems(supabase, input.cart_id)
        if (!result.ok) {
            return { error: result.message, status: result.status, cart: null, items: [] }
        }

        const gate = assertCartReadableByActor(result.cart, {
            authenticatedUserId: authenticatedUserId || null,
            trustedCartSessionId: trustedCartSessionId || null,
        })
        if (!gate.ok) {
            return { error: gate.message, status: gate.status, cart: null, items: [] }
        }

        return { cart: result.cart, items: result.items }
    },
})
