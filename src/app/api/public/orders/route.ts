import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/orders
 * List orders for a user. Query: user_id (required).
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
        return NextResponse.json(
            { error: 'user_id query is required' },
            { status: 400 }
        )
    }

    const { data, error } = await supabase
        .from('orders')
        .select(
            'id, user_id, status, total_amount, advance_amount, created_at, event_name, event_role, event_date, contact_name, guest_count'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
}
