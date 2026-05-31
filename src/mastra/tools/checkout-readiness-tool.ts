import { createTool } from '@mastra/core/tools'
import { supabase } from '@/lib/supabase/server'
import { assertCartReadableByActor, getCartWithItems } from '@/lib/cart-read-core'
import { cartRequiresFullPayment, computeOnlineChargeInr, type CartLineForPaymentMode } from '@/lib/cart-payment-mode'
import { computeProtectionAmountInr, fetchPlatformProtectionSettings } from '@/lib/booking-protection'
import { z } from 'zod'

/**
 * Read-only cart → checkout → payment readiness (advance vs full pay, estimated charge).
 */
export const getCheckoutReadinessTool = createTool({
    id: 'get_checkout_readiness',
    description:
        'Summarize cart checkout readiness: line items, subtotal, whether full payment is required (e-invites/special catalog), estimated online charge (20% advance or full), and next-step guidance. Read-only.',
    inputSchema: z.object({
        cart_id: z.string().uuid(),
        booking_protection: z.boolean().optional(),
    }),
    execute: async (input, context) => {
        const rc = context?.requestContext as { get?: (k: string) => unknown } | undefined
        const authenticatedUserId = (rc?.get?.('authenticatedUserId') as string | undefined | null) ?? null
        const trustedCartSessionId = (rc?.get?.('trustedCartSessionId') as string | undefined | null) ?? null

        const result = await getCartWithItems(supabase, input.cart_id)
        if (!result.ok) {
            return { error: result.message, status: result.status, ready: false }
        }

        const gate = assertCartReadableByActor(result.cart, {
            authenticatedUserId: authenticatedUserId || null,
            trustedCartSessionId: trustedCartSessionId || null,
        })
        if (!gate.ok) {
            return { error: gate.message, status: gate.status, ready: false }
        }

        type CartItemRow = CartLineForPaymentMode & { quantity?: number; unit_price?: number }
        const items = result.items as CartItemRow[]
        const subtotal = items.reduce(
            (sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_price || 0),
            0
        )
        const wantProtection = input.booking_protection === true
        const settings = await fetchPlatformProtectionSettings()
        const protectionInr = computeProtectionAmountInr(subtotal, settings, wantProtection)
        const fullPayment = cartRequiresFullPayment(items)
        const estimatedChargeInr = computeOnlineChargeInr(subtotal, protectionInr, fullPayment)

        return {
            cart: result.cart,
            items,
            subtotal_inr: subtotal,
            protection_inr: protectionInr,
            requires_full_payment: fullPayment,
            estimated_online_charge_inr: estimatedChargeInr,
            payment_mode: fullPayment ? 'full_at_checkout' : 'advance_20_percent',
            ready: result.items.length > 0,
            next_steps: fullPayment
                ? ['Confirm cart details in app', 'Pay full amount at checkout via Razorpay']
                : ['Confirm cart details in app', 'Pay 20% advance at checkout', 'Accept vendor quote later if amount changes'],
        }
    },
})
