import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAllowlistedAdminEmail } from '@/lib/admin-config'
import { applyPlanningCorsHeaders, isBrowserPlanningApiPath, planningCorsHeaders } from '@/lib/ai-planning-cors'

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Browser CORS for ekatraa-web → planning/voice APIs (handles OPTIONS before route handlers).
    if (isBrowserPlanningApiPath(pathname)) {
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, { status: 204, headers: planningCorsHeaders(request) })
        }
    }

    // Single pass-through response; mutating cookies on it preserves the original request
    // body for API routes (recreating NextResponse with only `headers` can drop bodies on Next 16+).
    let response = NextResponse.next()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
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

    if (isBrowserPlanningApiPath(pathname)) {
        return applyPlanningCorsHeaders(request, response)
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
