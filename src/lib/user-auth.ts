import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Resolves the Supabase Auth user id from a Bearer JWT (mobile app session).
 */
export async function getEndUserIdFromRequest(req: Request): Promise<
    | { userId: string; error: null }
    | { userId: null; error: NextResponse }
> {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')

    if (!token) {
        return {
            userId: null,
            error: NextResponse.json({ error: 'Authorization required. Pass Bearer token.' }, { status: 401 }),
        }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        return {
            userId: null,
            error: NextResponse.json({ error: 'Server auth configuration missing' }, { status: 500 }),
        }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user?.id) {
        return {
            userId: null,
            error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }),
        }
    }

    return { userId: user.id, error: null }
}
