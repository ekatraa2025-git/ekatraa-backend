import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json()
        const supabase = await createClient()

        if (email !== 'admin@ekatraa.com') {
            return NextResponse.json({ error: 'Only the designated admin account can log in.' }, { status: 403 })
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 401 })
        }

        return NextResponse.json({ user: data.user, session: data.session })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
