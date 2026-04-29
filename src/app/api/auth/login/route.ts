import { decryptAdminLoginPayload, isEncryptedLoginBodyV1 } from '@/lib/admin-login-crypto'
import { isAllowlistedAdminEmail } from '@/lib/admin-config'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type PendingCookie = { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] }

function parseCredentials(reqBody: unknown, privateKeyPem: string | undefined): {
    email: string
    password: string
} {
    if (privateKeyPem) {
        if (!isEncryptedLoginBodyV1(reqBody)) {
            throw new Error('ENCRYPTED_REQUIRED')
        }
        const creds = decryptAdminLoginPayload(privateKeyPem, reqBody)
        return { email: creds.email.trim(), password: creds.password }
    }
    if (!reqBody || typeof reqBody !== 'object') {
        throw new Error('INVALID_BODY')
    }
    const o = reqBody as Record<string, unknown>
    const email = o.email
    const password = o.password
    if (typeof email !== 'string' || typeof password !== 'string') {
        throw new Error('INVALID_BODY')
    }
    return { email: email.trim(), password }
}

export async function POST(req: NextRequest) {
    const pendingCookies: PendingCookie[] = []
    const privateKeyPem = process.env.ADMIN_LOGIN_RSA_PRIVATE_KEY?.trim()

    try {
        const reqBody: unknown = await req.json()
        let email: string
        let password: string
        try {
            ;({ email, password } = parseCredentials(reqBody, privateKeyPem))
        } catch (e) {
            const msg = e instanceof Error ? e.message : ''
            if (msg === 'ENCRYPTED_REQUIRED') {
                return NextResponse.json(
                    { error: 'Encrypted login is required. Configure keys or use the latest admin UI.' },
                    { status: 400 }
                )
            }
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
        }

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return req.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        pendingCookies.push(...cookiesToSet)
                    },
                },
            }
        )

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 401 })
        }

        if (!isAllowlistedAdminEmail(data.user?.email)) {
            await supabase.auth.signOut()
            const forbidden = NextResponse.json(
                {
                    error:
                        'This account is not allowed to use admin sign-in. Set ADMIN_EMAIL in the server environment to your Supabase user email (see .env.example), then restart the dev server.',
                },
                { status: 403 }
            )
            pendingCookies.forEach(({ name, value, options }) => {
                forbidden.cookies.set(name, value, options)
            })
            return forbidden
        }

        const out = NextResponse.json({ user: data.user, session: data.session }, { status: 200 })
        pendingCookies.forEach(({ name, value, options }) => {
            out.cookies.set(name, value, options)
        })
        return out
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
