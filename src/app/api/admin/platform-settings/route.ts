import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { BookingProtectionMode } from '@/lib/booking-protection'
import type { AiPrimaryProvider } from '@/lib/ai-runtime-settings'

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
            ai_primary_provider: 'openrouter',
            ai_primary_model: 'nvidia/nemotron-3-nano-omni:free',
            ai_openrouter_model: 'nvidia/nemotron-3-nano-omni:free',
            ai_openrouter_image_model: 'sourceful/riverflow-v2-fast',
            ai_openrouter_invite_animated_model: 'sourceful/riverflow-v2-pro',
            ai_claude_model: 'claude-sonnet-4-6',
            ai_gemini_model: 'gemini-3.1-flash-lite-preview',
        })
    }

    return NextResponse.json(data)
}

/**
 * PATCH /api/admin/platform-settings
 * Body: { booking_protection_mode?, booking_protection_fixed_inr?, booking_protection_percent?, ai_primary_provider?, ai_primary_model?, ai_openrouter_model?, ai_openrouter_image_model?, ai_openrouter_invite_animated_model?, ai_claude_model?, ai_gemini_model? }
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
        if (body.ai_primary_provider !== undefined) {
            const p = String(body.ai_primary_provider || '').trim().toLowerCase()
            if (p !== 'openrouter' && p !== 'claude' && p !== 'gemini') {
                return NextResponse.json({ error: 'ai_primary_provider must be openrouter, claude, or gemini' }, { status: 400 })
            }
            updates.ai_primary_provider = p as AiPrimaryProvider
        }
        if (body.ai_primary_model !== undefined) {
            const m = String(body.ai_primary_model || '').trim()
            if (!m) return NextResponse.json({ error: 'ai_primary_model cannot be empty' }, { status: 400 })
            updates.ai_primary_model = m
        }
        if (body.ai_openrouter_model !== undefined) {
            const m = String(body.ai_openrouter_model || '').trim()
            if (!m) return NextResponse.json({ error: 'ai_openrouter_model cannot be empty' }, { status: 400 })
            updates.ai_openrouter_model = m
        }
        if (body.ai_openrouter_image_model !== undefined) {
            const m = String(body.ai_openrouter_image_model || '').trim()
            if (!m) return NextResponse.json({ error: 'ai_openrouter_image_model cannot be empty' }, { status: 400 })
            updates.ai_openrouter_image_model = m
        }
        if (body.ai_openrouter_invite_animated_model !== undefined) {
            const m = String(body.ai_openrouter_invite_animated_model || '').trim()
            if (!m) return NextResponse.json({ error: 'ai_openrouter_invite_animated_model cannot be empty' }, { status: 400 })
            updates.ai_openrouter_invite_animated_model = m
        }
        if (body.ai_claude_model !== undefined) {
            const m = String(body.ai_claude_model || '').trim()
            if (!m) return NextResponse.json({ error: 'ai_claude_model cannot be empty' }, { status: 400 })
            updates.ai_claude_model = m
        }
        if (body.ai_gemini_model !== undefined) {
            const m = String(body.ai_gemini_model || '').trim()
            if (!m) return NextResponse.json({ error: 'ai_gemini_model cannot be empty' }, { status: 400 })
            updates.ai_gemini_model = m
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
        }

        // Keep `ai_primary_model` aligned with provider-specific model unless explicitly set.
        if (!updates.ai_primary_model) {
            const nextProvider = String(updates.ai_primary_provider || body.ai_primary_provider || '').trim().toLowerCase()
            if (nextProvider === 'openrouter') {
                updates.ai_primary_model = String(updates.ai_openrouter_model || body.ai_openrouter_model || '').trim()
            } else if (nextProvider === 'claude') {
                updates.ai_primary_model = String(updates.ai_claude_model || body.ai_claude_model || '').trim()
            } else if (nextProvider === 'gemini') {
                updates.ai_primary_model = String(updates.ai_gemini_model || body.ai_gemini_model || '').trim()
            }
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
