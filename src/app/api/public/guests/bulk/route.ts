import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/public/guests/bulk
 * Bulk import guests. Body: { user_id, guests: [{ name, phone?, relation?, group_name? }] }
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { user_id, guests } = body

        if (!user_id || !Array.isArray(guests) || guests.length === 0) {
            return NextResponse.json(
                { error: 'user_id and non-empty guests array are required' },
                { status: 400 }
            )
        }

        const rows = guests
            .filter((g: { name?: string }) => g.name?.trim())
            .map((g: { name: string; phone?: string; relation?: string; group_name?: string; notes?: string }) => ({
                user_id,
                name: g.name.trim(),
                phone: g.phone || null,
                relation: g.relation || null,
                group_name: g.group_name || null,
                notes: g.notes || null,
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
