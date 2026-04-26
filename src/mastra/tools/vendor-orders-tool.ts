import { createTool } from '@mastra/core/tools'
import { supabase } from '@/lib/supabase/server'
import { z } from 'zod'

export const listVendorOrdersTool = createTool({
    id: 'list_my_orders',
    description:
        'List orders for the authenticated vendor (read-only). vendor_id is injected by the server; never trust a model-supplied vendor id.',
    inputSchema: z.object({
        status: z.string().optional().describe('Optional order status filter'),
    }),
    execute: async (input, context) => {
        const rc = context?.requestContext as { get?: (k: string) => unknown } | undefined
        const vendorId = rc?.get?.('vendorId') as string | undefined
        if (!vendorId) {
            return { error: 'Missing vendor context', orders: [] }
        }

        let query = supabase
            .from('orders')
            .select('id, status, created_at, planned_budget_inr')
            .eq('vendor_id', vendorId)
            .order('created_at', { ascending: false })
            .limit(25)

        if (input.status && input.status !== 'all') {
            query = query.eq('status', input.status)
        }

        const { data, error } = await query
        if (error) return { error: error.message, orders: [] }
        return { orders: data ?? [] }
    },
})
