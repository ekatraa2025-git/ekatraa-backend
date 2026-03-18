import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/orders/[id]
 * Order detail with items and status history.
 * Query: user_id (optional) - when provided and matches order owner, includes completion_otp for vendor OTP flow.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    if (!id) {
        return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const { data: items } = await supabase
        .from('order_items')
        .select('id, service_id, name, quantity, unit_price, options')
        .eq('order_id', id)

    const { data: history } = await supabase
        .from('order_status_history')
        .select('status, note, created_at')
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
                                if (url.startsWith('http') && url.includes('token=')) return url
                                let fileName = url
                                if (url.startsWith('http')) {
                                    const m = url.match(/\/ekatraa2025\/([^/?]+)/)
                                    fileName = m?.[1] || url.split('/').pop()?.split('?')[0] || url
                                }
                                const { data } = await supabase.storage.from('ekatraa2025').createSignedUrl(fileName, 86400)
                                return data?.signedUrl || supabase.storage.from('ekatraa2025').getPublicUrl(fileName).data?.publicUrl || url
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
    if (userId && order.user_id === userId) {
        const { data: otpRow } = await supabase
            .from('order_completion_otp')
            .select('otp, expires_at')
            .eq('order_id', id)
            .single()
        if (otpRow && new Date(otpRow.expires_at) > new Date()) {
            completionOtp = otpRow.otp
        }
    }

    return NextResponse.json({
        ...order,
        items: items ?? [],
        status_history: history ?? [],
        quotes,
        vendor_quotes: quotes,
        ...(completionOtp ? { completion_otp: completionOtp } : {}),
    })
}
