import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { ADMIN_EMAIL } from '@/lib/admin-config'

/**
 * Defense in depth for /api/admin handlers that use the service-role Supabase client.
 * Middleware already gates /api/admin; this repeats the same cookie + email check so
 * a misconfigured matcher cannot expose service-role queries.
 */
export async function requireAdminSession(): Promise<
    { ok: true } | { ok: false; response: NextResponse }
> {
    const supabase = await createClient()
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error || !user) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
        }
    }

    if (user.email !== ADMIN_EMAIL) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
        }
    }

    return { ok: true }
}
