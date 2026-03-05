import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/public/cart
 * Create a new cart. Body: { user_id?: string, session_id?: string, event_name?, event_date?, ... }
 * At least one of user_id or session_id required for anonymous.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const {
            user_id,
            session_id,
            event_name,
            event_date,
            guest_count,
            location_preference,
            venue_preference,
            planned_budget,
            contact_name,
            contact_mobile,
            contact_email,
        } = body

        if (!user_id && !session_id) {
            return NextResponse.json(
                { error: 'Either user_id or session_id is required' },
                { status: 400 }
            )
        }

        const { data, error } = await supabase
            .from('carts')
            .insert([
                {
                    user_id: user_id ?? null,
                    session_id: session_id ?? null,
                    event_name: event_name ?? null,
                    event_date: event_date ?? null,
                    guest_count: guest_count ?? null,
                    location_preference: location_preference ?? null,
                    venue_preference: venue_preference ?? null,
                    planned_budget: planned_budget ?? null,
                    contact_name: contact_name ?? null,
                    contact_mobile: contact_mobile ?? null,
                    contact_email: contact_email ?? null,
                },
            ])
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
