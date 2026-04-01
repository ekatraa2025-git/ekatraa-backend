import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * GET /api/public/guests
 * List all guests for the authenticated user.
 */
export async function GET(req: Request) {
    const { userId, error: authError } = await getEndUserIdFromRequest(req)
    if (authError) return authError

    const { data, error } = await supabase
        .from('guest_lists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
}

/**
 * POST /api/public/guests
 * Add a guest for the authenticated user. Body: { name, phone?, relation?, group_name?, notes? }
 */
export async function POST(req: Request) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const body = await req.json()
        const { name, phone, relation, group_name, notes, invited, rsvp } = body

        if (!name?.trim()) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('guest_lists')
            .insert([{
                user_id: userId,
                name: name.trim(),
                phone: phone || null,
                relation: relation || null,
                group_name: group_name || null,
                notes: notes || null,
                invited: invited ?? false,
                rsvp: rsvp || 'pending',
            }])
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json(data, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}

/**
 * DELETE /api/public/guests
 * Bulk import: POST with array body handled separately.
 * This DELETE removes by ?id=
 */
