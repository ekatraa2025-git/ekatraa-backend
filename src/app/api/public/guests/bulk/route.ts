import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEndUserIdFromRequest } from '@/lib/user-auth'

/**
 * POST /api/public/guests/bulk
 * Bulk import guests for the authenticated user. Body: { guests: [{ name, phone?, relation?, group_name? }] }
 */
export async function POST(req: Request) {
    try {
        const { userId, error: authError } = await getEndUserIdFromRequest(req)
        if (authError) return authError

        const body = await req.json()
        const { guests } = body

        if (!Array.isArray(guests) || guests.length === 0) {
            return NextResponse.json(
                { error: 'Non-empty guests array is required' },
                { status: 400 }
            )
        }

        if (guests.length > 500) {
            return NextResponse.json({ error: 'Cannot import more than 500 guests at once' }, { status: 400 })
        }

        const rows = guests
            .filter((g: { name?: string }) => g.name?.trim())
            .map((g: { name: string; phone?: string; relation?: string; group_name?: string; notes?: string }) => ({
                user_id: userId,
                name: g.name.trim().substring(0, 100),
                phone: g.phone ? String(g.phone).substring(0, 20) : null,
                relation: g.relation ? String(g.relation).substring(0, 50) : null,
                group_name: g.group_name ? String(g.group_name).substring(0, 50) : null,
                notes: g.notes ? String(g.notes).substring(0, 500) : null,
                invited: false,
                rsvp: 'pending',
            }))

        if (rows.length === 0) {
            return NextResponse.json({ error: 'No valid guests to import' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('guest_lists')
            .insert(rows)
            .select()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ imported: data?.length ?? 0, guests: data ?? [] }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
