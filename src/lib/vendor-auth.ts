import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Extracts vendor ID from Authorization Bearer token (Supabase JWT).
 * Returns { vendorId, error } - error is a NextResponse if auth failed.
 */
export async function getVendorFromRequest(req: Request): Promise<
    | { vendorId: string; error: null }
    | { vendorId: null; error: NextResponse }
> {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')

    if (!token) {
        return {
            vendorId: null,
            error: NextResponse.json({ error: 'Authorization required. Pass Bearer token.' }, { status: 401 }),
        }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        return {
            vendorId: null,
            error: NextResponse.json({ error: 'Server auth configuration missing' }, { status: 500 }),
        }
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user?.id) {
        return {
            vendorId: null,
            error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }),
        }
    }

    // Verify user is a vendor (use server client for DB access)
    const { supabase: serverSupabase } = await import('@/lib/supabase/server')
    const { data: vendor } = await serverSupabase
        .from('vendors')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

    if (!vendor) {
        return {
            vendorId: null,
            error: NextResponse.json({ error: 'User is not a registered vendor' }, { status: 403 }),
        }
    }

    return { vendorId: user.id, error: null }
}
