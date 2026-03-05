import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Admin: list orders, filter by status.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
}
