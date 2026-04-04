import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'

/**
 * GET /api/public/orders/[id]
 * Order detail with items and status history.
 * When authenticated as order owner, includes completion_otp and start_otp for vendor OTP flows.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.user_id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: rawItems } = await supabase
        .from('order_items')
        .select(
            `id, service_id, name, quantity, unit_price, options,
            offerable_services (
              id, name, category_id,
              qty_label_basic, qty_label_classic_value, qty_label_signature, qty_label_prestige, qty_label_royal, qty_label_imperial,
              sub_variety_basic, sub_variety_classic_value, sub_variety_signature, sub_variety_prestige, sub_variety_royal, sub_variety_imperial,
              categories (id, name)
            )`
        )
        .eq('order_id', id)

    const items = (rawItems ?? []).map((row: Record<string, unknown>) => {
        const os = row.offerable_services as Record<string, unknown> | null | undefined
        let service: Record<string, unknown> | undefined
        if (os && typeof os === 'object') {
            const catRaw = os.categories as { id?: string; name?: string } | { id?: string; name?: string }[] | null | undefined
            const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw
            const category =
                cat && typeof cat === 'object' ? { id: cat.id, name: cat.name } : undefined
            const { categories: _c, ...rest } = os
            service = { ...rest, category }
        }
        const { offerable_services: _o, ...rest } = row
        return { ...rest, service }
    })

    const { data: history } = await supabase
        .from('order_status_history')
        .select('id, status, note, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: true })

    const { data: quotations } = await supabase
        .from('quotations')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: false })

    let quotes: Array<Record<string, unknown>> = (quotations ?? []) as Array<Record<string, unknown>>
    if (quotes.length > 0) {
        const vendorIds = [...new Set(quotes.map((q) => q.vendor_id as string).filter(Boolean))]
        const { data: vendors } = await supabase
            .from('vendors')
            .select('id, business_name')
            .in('id', vendorIds)
        const vendorMap = new Map((vendors ?? []).map((v: { id: string; business_name: string }) => [v.id, v.business_name]))
        quotes = quotes.map((q) => ({
            ...q,
            vendor_name: q.vendor_id ? vendorMap.get(q.vendor_id as string) ?? null : null,
        }))

        // Generate signed URLs for quotation attachments
        for (const q of quotes) {
            const att = q.attachments
            if (att && typeof att === 'object') {
                const signed: Record<string, string[]> = {}
                for (const [category, urls] of Object.entries(att)) {
                    if (Array.isArray(urls)) {
                        const resolved = await Promise.all(
                            (urls as string[]).map(async (url: string) => {
                                const signed = await signedUrlForStorageRef(url)
                                return signed ?? url
                            })
                        )
                        signed[category] = resolved
                    }
                }
                q.attachments = signed
            }
        }
    }

    let completionOtp: string | null = null
    let startOtp: string | null = null
    if (userId) {
        const { data: completionRow } = await supabase
            .from('order_completion_otp')
            .select('otp, expires_at')
            .eq('order_id', id)
            .single()
        if (completionRow && new Date(completionRow.expires_at) > new Date()) {
            completionOtp = completionRow.otp
        }
        const { data: startRow } = await supabase
            .from('order_start_otp')
            .select('otp, expires_at')
            .eq('order_id', id)
            .single()
        if (startRow && new Date(startRow.expires_at) > new Date()) {
            startOtp = startRow.otp
        }
    }

    return NextResponse.json({
        ...order,
        items: items ?? [],
        status_history: history ?? [],
        quotes,
        ...(completionOtp ? { completion_otp: completionOtp } : {}),
        ...(startOtp ? { start_otp: startOtp } : {}),
    })
}
