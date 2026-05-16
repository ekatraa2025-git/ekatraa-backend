import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}))
        const email = String(body?.email || '').trim().toLowerCase()
        const password = String(body?.password || '')
        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!supabaseUrl || !supabaseAnonKey) {
            return NextResponse.json({ error: 'Server auth configuration missing' }, { status: 500 })
        }

        const anon = createClient(supabaseUrl, supabaseAnonKey)
        const { data, error } = await anon.auth.signInWithPassword({ email, password })
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 401 })
        }
        if (!data?.session) {
            return NextResponse.json({ error: 'Session not created after login.' }, { status: 401 })
        }

        return NextResponse.json({
            ok: true,
            user: data.user,
            session: data.session,
        })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 })
    }
}
