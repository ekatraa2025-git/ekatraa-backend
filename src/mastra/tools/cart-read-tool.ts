import { createTool } from '@mastra/core/tools'
import { supabase } from '@/lib/supabase/server'
import { getCartWithItems } from '@/lib/cart-read-core'
import { z } from 'zod'

export const getCartReadTool = createTool({
    id: 'get_cart_summary',
    description: 'Read a shopping cart by UUID including line items and service names (read-only).',
    inputSchema: z.object({
        cart_id: z.string().uuid().describe('Public cart id'),
    }),
    execute: async (input) => {
        const result = await getCartWithItems(supabase, input.cart_id)
        if (!result.ok) {
            return { error: result.message, status: result.status, cart: null, items: [] }
        }
        return { cart: result.cart, items: result.items }
    },
})
