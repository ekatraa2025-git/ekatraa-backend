import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAllowlistedAdminEmail } from '@/lib/admin-config'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    const isAdminPage = request.nextUrl.pathname.startsWith('/admin')
    const isAdminApi = request.nextUrl.pathname.startsWith('/api/admin')

    // Protect /admin page routes and /api/admin/* API routes
    if (isAdminPage || isAdminApi) {
        if (!user) {
            if (isAdminApi) {
                return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
            }
            return NextResponse.redirect(new URL('/login', request.url))
        }

        // Check if the user is the allowlisted admin email
        if (!isAllowlistedAdminEmail(user.email)) {
            if (isAdminApi) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
            await supabase.auth.signOut()
            return NextResponse.redirect(new URL('/login?error=Unauthorized', request.url))
        }
    }

    // Redirect to /admin if logged in and trying to access /login
    if (request.nextUrl.pathname === '/login' && user && isAllowlistedAdminEmail(user.email)) {
        return NextResponse.redirect(new URL('/admin', request.url))
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
