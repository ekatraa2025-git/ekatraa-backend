import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/** Supabase access tokens are JWTs; OpenAI/Pipecat api keys are not. */
export function isLikelySupabaseJwt(token: string): boolean {
    const t = token.trim()
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)
}

export function extractBearerToken(headerValue: string | null): string | null {
    const token = headerValue?.replace(/^Bearer\s+/i, '')?.trim()
    return token || null
}

/**
 * Resolves the Supabase Auth user id from a Bearer JWT (mobile app session).
 */
export async function getUserIdFromAccessToken(token: string): Promise<
    | { userId: string; error: null }
    | { userId: null; error: NextResponse }
> {
    const trimmed = token.trim()
    if (!trimmed) {
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
    } = await supabase.auth.getUser(trimmed)

    if (userError || !user?.id) {
        return {
            userId: null,
            error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }),
        }
    }

    return { userId: user.id, error: null }
}

export async function getEndUserIdFromRequest(req: Request): Promise<
    | { userId: string; error: null }
    | { userId: null; error: NextResponse }
> {
    const token = extractBearerToken(req.headers.get('Authorization'))
    if (!token) {
        return {
            userId: null,
            error: NextResponse.json({ error: 'Authorization required. Pass Bearer token.' }, { status: 401 }),
        }
    }
    return getUserIdFromAccessToken(token)
}

/**
 * Resolves JWT when present without requiring auth (returns null if omitted).
 * Non-JWT Authorization values (e.g. OpenAI api keys from Pipecat) are ignored.
 */
export async function resolveOptionalBearerUser(req: Request): Promise<
    { userId: string | null; error: null } | { userId: null; error: NextResponse }
> {
    const token = extractBearerToken(req.headers.get('Authorization'))
    if (!token) {
        return { userId: null, error: null }
    }
    if (!isLikelySupabaseJwt(token)) {
        return { userId: null, error: null }
    }
    return getUserIdFromAccessToken(token)
}

/**
 * Voice pipelines: user JWT may arrive on X-User-Authorization so OpenAI-compatible
 * Authorization can remain the Pipecat/OpenAI api key.
 */
export async function resolveVoiceUserId(req: Request): Promise<
    { userId: string | null; error: null } | { userId: null; error: NextResponse }
> {
    const userToken = extractBearerToken(req.headers.get('X-User-Authorization'))
    if (userToken && isLikelySupabaseJwt(userToken)) {
        return getUserIdFromAccessToken(userToken)
    }
    return resolveOptionalBearerUser(req)
}
