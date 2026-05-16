import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function normalizeIndianPhone(raw: string): string {
    const digits = String(raw || '').replace(/\D/g, '').slice(-10)
    if (digits.length !== 10) return ''
    return `+91${digits}`
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}))
        const phone = normalizeIndianPhone(String(body?.phone || ''))
        if (!phone) {
            return NextResponse.json({ error: 'Valid 10-digit phone is required.' }, { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!supabaseUrl || !supabaseAnonKey) {
            return NextResponse.json({ error: 'Server auth configuration missing' }, { status: 500 })
        }

        const anon = createClient(supabaseUrl, supabaseAnonKey)
        const { error } = await anon.auth.signInWithOtp({ phone })
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ ok: true, message: 'OTP sent successfully.' })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
    }
}
