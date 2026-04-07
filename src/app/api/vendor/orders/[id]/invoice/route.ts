import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'
import { sendNotificationToUser } from '@/lib/notifications'

type LineItem = { description: string; quantity: number; unit_price: number; amount: number }

function round2(n: number): number {
    return Math.round(n * 100) / 100
}

async function assertVendorAllocated(orderId: string, vendorId: string): Promise<{ ok: boolean; order: Record<string, unknown> | null }> {
    const { data: order, error } = await supabase.from('orders').select('id, vendor_id, status, user_id').eq('id', orderId).single()
    if (error || !order) return { ok: false, order: null }
    const hasOrderLevel = (order as { vendor_id?: string }).vendor_id === vendorId
    let hasItem = false
    if (!hasOrderLevel) {
        const { data: items } = await supabase.from('order_items').select('id').eq('order_id', orderId)
        const itemIds = (items ?? []).map((i: { id: string }) => i.id)
        if (itemIds.length > 0) {
            const { data: alloc } = await supabase
                .from('order_item_allocations')
                .select('id')
                .eq('vendor_id', vendorId)
                .in('order_item_id', itemIds)
                .limit(1)
            hasItem = (alloc?.length ?? 0) > 0
        }
    }
    if (!hasOrderLevel && !hasItem) return { ok: false, order: null }
    return { ok: true, order: order as Record<string, unknown> }
}

/**
 * GET /api/vendor/orders/[id]/invoice
 * Prefill from order line items + vendor branding. Includes existing submitted invoice if present.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { id: orderId } = await params
    if (!orderId) return NextResponse.json({ error: 'Order id required' }, { status: 400 })

    const { ok, order } = await assertVendorAllocated(orderId, auth.vendorId!)
    if (!ok || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if ((order.status as string) !== 'completed') {
        return NextResponse.json({ error: 'Invoice is only available after the order is completed (completion OTP).' }, { status: 400 })
    }

    const { data: items } = await supabase
        .from('order_items')
        .select('id, name, quantity, unit_price')
        .eq('order_id', orderId)

    const { data: vendor } = await supabase
        .from('vendors')
        .select('id, business_name, logo_url')
        .eq('id', auth.vendorId!)
        .single()

    const defaultLines: LineItem[] = (items ?? []).map((i: { name?: string; quantity?: number; unit_price?: number }) => {
        const q = Number(i.quantity) || 0
        const up = Number(i.unit_price) || 0
        return {
            description: String(i.name || 'Service'),
            quantity: q,
            unit_price: up,
            amount: round2(q * up),
        }
    })

    const { data: existing } = await supabase.from('order_vendor_invoices').select('*').eq('order_id', orderId).maybeSingle()

    return NextResponse.json({
        order_id: orderId,
        can_edit: !existing || existing.status !== 'accepted',
        defaults: {
            line_items: defaultLines,
            vendor_display_name: (vendor as { business_name?: string })?.business_name || '',
            vendor_logo_url: (vendor as { logo_url?: string })?.logo_url || '',
            vendor_gstin: '',
            cgst_rate: 9,
            sgst_rate: 9,
            invoice_number: `INV-${String(orderId).slice(0, 8).toUpperCase()}`,
            notes: '',
        },
        invoice: existing || null,
    })
}

/**
 * PUT /api/vendor/orders/[id]/invoice
 * Submit or update final invoice (until customer accepts).
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getVendorFromRequest(req)
    if (auth.error) return auth.error

    const { id: orderId } = await params
    if (!orderId) return NextResponse.json({ error: 'Order id required' }, { status: 400 })

    const { ok, order } = await assertVendorAllocated(orderId, auth.vendorId!)
    if (!ok || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    if ((order.status as string) !== 'completed') {
        return NextResponse.json({ error: 'Invoice can only be submitted after order is completed.' }, { status: 400 })
    }

    const { data: existing } = await supabase.from('order_vendor_invoices').select('id, status').eq('order_id', orderId).maybeSingle()
    if (existing?.status === 'accepted') {
        return NextResponse.json({ error: 'Invoice already accepted by customer. It cannot be changed.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const line_items = Array.isArray(body?.line_items) ? body.line_items : []
    const cgst_rate = Math.min(100, Math.max(0, Number(body?.cgst_rate ?? 9)))
    const sgst_rate = Math.min(100, Math.max(0, Number(body?.sgst_rate ?? 9)))
    const vendor_display_name = String(body?.vendor_display_name ?? '').trim()
    const vendor_logo_url = String(body?.vendor_logo_url ?? '').trim() || null
    const vendor_gstin = String(body?.vendor_gstin ?? '').trim() || null
    const invoice_number = String(body?.invoice_number ?? '').trim() || null
    const notes = String(body?.notes ?? '').trim() || null

    const normalized: LineItem[] = line_items.map((row: Record<string, unknown>) => {
        const quantity = Math.max(0, Number(row.quantity) || 0)
        const unit_price = Math.max(0, Number(row.unit_price) || 0)
        const amount = round2(quantity * unit_price)
        return {
            description: String(row.description ?? 'Item').slice(0, 500),
            quantity,
            unit_price,
            amount,
        }
    })

    if (normalized.length === 0) {
        return NextResponse.json({ error: 'Add at least one line item.' }, { status: 400 })
    }

    const subtotal = round2(normalized.reduce((s, l) => s + l.amount, 0))
    const cgst_amount = round2((subtotal * cgst_rate) / 100)
    const sgst_amount = round2((subtotal * sgst_rate) / 100)
    const total_amount = round2(subtotal + cgst_amount + sgst_amount)

    const row = {
        order_id: orderId,
        vendor_id: auth.vendorId!,
        status: 'submitted' as const,
        line_items: normalized,
        subtotal,
        cgst_rate,
        sgst_rate,
        cgst_amount,
        sgst_amount,
        total_amount,
        vendor_display_name: vendor_display_name || null,
        vendor_logo_url,
        vendor_gstin,
        invoice_number,
        notes,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }

    const { data: saved, error } = await supabase
        .from('order_vendor_invoices')
        .upsert(row, { onConflict: 'order_id' })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const userId = order.user_id as string
    if (userId) {
        sendNotificationToUser({
            user_id: userId,
            type: 'order_invoice',
            title: 'Final invoice ready',
            message: `Your vendor submitted a final invoice of ₹${total_amount.toLocaleString('en-IN')} for your order. Review and accept in order details.`,
            data: { order_id: orderId, invoice_id: saved?.id },
        }).catch(() => {})
    }

    return NextResponse.json({ success: true, invoice: saved })
}
