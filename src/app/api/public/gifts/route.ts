import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * GET /api/public/gifts
 * List all gifts for the authenticated user.
 */
export async function GET(req: Request) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { data, error } = await supabase
        .from('guest_gifts')
        .select('*, guest_lists(id, name, phone)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const mapped = (data ?? []).map((gift: { guest_lists?: { name?: string } }) => ({
        ...gift,
        guest_name: gift.guest_lists?.name || '',
        guest_lists: undefined,
    }))

    return NextResponse.json(mapped)
}

/**
 * POST /api/public/gifts
 * Record a gift. Body: { guest_id, type?, amount?, description? }
 */
export async function POST(req: Request) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const body = await req.json()
        const { guest_id, type, amount, description } = body

        if (!guest_id) {
            return NextResponse.json({ error: 'guest_id is required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('guest_gifts')
            .insert([{
                user_id: userId,
                guest_id,
                type: type || 'cash',
                amount: amount ? parseFloat(amount) : 0,
                description: description || null,
            }])
            .select('*, guest_lists(id, name)')
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        const mapped = {
            ...data,
            guest_name: data.guest_lists?.name || '',
            guest_lists: undefined,
        }

        return NextResponse.json(mapped, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
