import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/notifications/audit?order_id=<uuid>&limit=50
 * Quick ops endpoint to verify vendor notification delivery for an order.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('order_id')?.trim()
    const limitRaw = Number(searchParams.get('limit') || 50)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50

    if (!orderId) {
        return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('vendor_notifications')
        .select('id, vendor_id, type, title, message, data, read, created_at')
        .order('created_at', { ascending: false })
        .limit(1000)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const matched = (data || [])
        .filter((row: { data?: Record<string, unknown> | null }) => {
            const d = row.data || {}
            const rowOrderId = d.order_id != null ? String(d.order_id) : ''
            return rowOrderId === orderId
        })
        .slice(0, limit)

    return NextResponse.json({
        order_id: orderId,
        count: matched.length,
        notifications: matched,
    })
}

