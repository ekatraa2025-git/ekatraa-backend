import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'
import { signQuotationAttachments } from '@/lib/quotation-attachments'
import { signedUrlForStorageRef } from '@/lib/storage-display-url'
import { eInviteIdsFromItems } from '@/lib/e-invite-order'

/**
 * GET /api/public/orders/[id]
 * Order detail for the authenticated customer (items, quotes, status history, vendor invoice).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { id: orderId } = await params
    if (!orderId) {
        return NextResponse.json({ error: 'Order id required' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.user_id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const [{ data: items }, { data: history }, { data: quotations }, { data: vendorInvoice }] =
        await Promise.all([
            supabase.from('order_items').select('*').eq('order_id', orderId),
            supabase
                .from('order_status_history')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: true }),
            supabase
                .from('quotations')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false }),
            supabase
                .from('order_vendor_invoices')
                .select('*')
                .eq('order_id', orderId)
                .maybeSingle(),
        ])

    const vendorIds = [...new Set((quotations ?? []).map((q: { vendor_id?: string }) => q.vendor_id).filter(Boolean))]
    let vendorsMap = new Map<string, string>()
    if (vendorIds.length > 0) {
        const { data: vendors } = await supabase
            .from('vendors')
            .select('id, business_name')
            .in('id', vendorIds as string[])
        for (const v of vendors ?? []) {
            vendorsMap.set((v as { id: string }).id, (v as { business_name: string }).business_name)
        }
    }

    const quotes = await Promise.all(
        (quotations ?? []).map(async (q: Record<string, unknown>) => ({
            ...q,
            vendor_name: q.vendor_id ? vendorsMap.get(String(q.vendor_id)) ?? null : null,
            attachments: await signQuotationAttachments(q.attachments),
        }))
    )

    const inviteIds = eInviteIdsFromItems((items ?? []) as { options?: unknown }[])
    let eInvites: Array<Record<string, unknown>> = []
    if (inviteIds.length > 0) {
        const { data: inviteRows } = await supabase
            .from('user_e_invites')
            .select('id, media_kind, storage_path, price_inr, payment_status, paid_at, form_payload, created_at')
            .in('id', inviteIds)
            .eq('user_id', userId)

        eInvites = await Promise.all(
            (inviteRows ?? []).map(async (inv) => {
                const fp =
                    inv.form_payload && typeof inv.form_payload === 'object' && !Array.isArray(inv.form_payload)
                        ? (inv.form_payload as Record<string, unknown>)
                        : {}
                const previewUrl = await signedUrlForStorageRef(inv.storage_path)
                const downloadUrl =
                    inv.payment_status === 'paid' ? previewUrl : null
                return {
                    id: inv.id,
                    media_kind: inv.media_kind,
                    payment_status: inv.payment_status,
                    price_inr: inv.price_inr,
                    paid_at: inv.paid_at,
                    output_mime: fp.output_mime ?? (inv.media_kind === 'animated' ? 'video/mp4' : 'image/png'),
                    event_name: fp.event_name ?? fp.eventName ?? null,
                    occasion: fp.occasion ?? null,
                    preview_url: previewUrl,
                    download_url: downloadUrl,
                    design_redesign_count: Number(fp.design_redesign_count || 0),
                }
            })
        )
    }

    return NextResponse.json({
        ...order,
        items: items ?? [],
        status_history: history ?? [],
        quotes,
        vendor_quotes: quotes,
        vendor_invoice: vendorInvoice ?? null,
        e_invites: eInvites,
    })
}
