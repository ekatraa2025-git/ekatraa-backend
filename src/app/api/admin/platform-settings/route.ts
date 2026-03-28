import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { BookingProtectionMode } from '@/lib/booking-protection'

/**
 * GET /api/admin/platform-settings — single row for id `default`
 */
export async function GET() {
    const { data, error } = await supabase.from('platform_settings').select('*').eq('id', 'default').maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
        return NextResponse.json({
            id: 'default',
            booking_protection_mode: 'none',
            booking_protection_fixed_inr: 0,
            booking_protection_percent: 0,
        })
    }

    return NextResponse.json(data)
}

/**
 * PATCH /api/admin/platform-settings
 * Body: { booking_protection_mode?, booking_protection_fixed_inr?, booking_protection_percent? }
 */
export async function PATCH(req: Request) {
    try {
        const body = await req.json().catch(() => ({}))
        const updates: Record<string, unknown> = {}

        if (body.booking_protection_mode !== undefined) {
            const m = body.booking_protection_mode as string
            if (m !== 'none' && m !== 'fixed' && m !== 'percent') {
                return NextResponse.json({ error: 'booking_protection_mode must be none, fixed, or percent' }, { status: 400 })
            }
            updates.booking_protection_mode = m as BookingProtectionMode
        }
        if (body.booking_protection_fixed_inr !== undefined) {
            updates.booking_protection_fixed_inr = Math.max(0, Math.round(Number(body.booking_protection_fixed_inr)))
        }
        if (body.booking_protection_percent !== undefined) {
            const p = Number(body.booking_protection_percent)
            if (!Number.isFinite(p) || p < 0 || p > 100) {
                return NextResponse.json({ error: 'booking_protection_percent must be between 0 and 100' }, { status: 400 })
            }
            updates.booking_protection_percent = p
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
        }

        updates.updated_at = new Date().toISOString()

        const { data, error } = await supabase
            .from('platform_settings')
            .update(updates)
            .eq('id', 'default')
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json(data)
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
