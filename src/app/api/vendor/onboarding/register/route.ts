import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/server'

type OnboardingServicePayload = {
    name?: string
    category?: string
    price_amount?: number
    image_urls?: string[]
}

type OnboardingPayload = {
    business_name?: string
    category?: string
    phone?: string
    address?: string
    latitude?: number
    longitude?: number
    description?: string | null
    logo_url?: string | null
    has_services?: boolean
    service?: OnboardingServicePayload | null
}

function normalizePhoneForDb(raw: string): string {
    const digits = String(raw || '').replace(/\D/g, '').slice(-10)
    if (digits.length === 10) return `+91${digits}`
    return String(raw || '').trim()
}

function normalizePhoneDigits(raw: string | null | undefined): string {
    return String(raw || '').replace(/\D/g, '').slice(-10)
}

async function resolveOwnerVendorId(
    serverSupabase: typeof supabase,
    user: { id: string; phone?: string | null; email?: string | null }
): Promise<string> {
    const byId = await serverSupabase.from('vendors').select('id').eq('id', user.id).maybeSingle()
    if (byId.data?.id) return String(byId.data.id)

    const phoneDigits = normalizePhoneDigits(user.phone)
    if (phoneDigits.length === 10) {
        for (const variant of [`+91${phoneDigits}`, phoneDigits, `91${phoneDigits}`]) {
            const byPhone = await serverSupabase.from('vendors').select('id').eq('phone', variant).maybeSingle()
            if (byPhone.data?.id) return String(byPhone.data.id)
        }
    }

    const email = String(user.email || '').trim().toLowerCase()
    if (email) {
        const byEmail = await serverSupabase.from('vendors').select('id').ilike('email', email).limit(1).maybeSingle()
        if (byEmail.data?.id) return String(byEmail.data.id)
    }

    return user.id
}

async function ensureRequesterMembership(
    serverSupabase: typeof supabase,
    user: { id: string; phone?: string | null; user_metadata?: Record<string, unknown> | null },
    vendorId: string
): Promise<void> {
    if (!user?.id || !vendorId || user.id === vendorId) return
    const normalizedPhone = normalizePhoneDigits(user.phone)
    const fullName =
        String(user.user_metadata?.full_name || user.user_metadata?.name || '').trim() || 'Vendor Owner'
    const byUserId = await serverSupabase
        .from('vendor_team_members')
        .select('id, vendor_id')
        .eq('member_user_id', user.id)
        .maybeSingle()
    if (byUserId.data?.id) {
        await serverSupabase
            .from('vendor_team_members')
            .update({
                vendor_id: vendorId,
                full_name: fullName,
                phone: normalizedPhone || null,
                role: 'manager',
                status: 'active',
                updated_at: new Date().toISOString(),
            })
            .eq('id', byUserId.data.id)
        return
    }

    const existing = await serverSupabase
        .from('vendor_team_members')
        .select('id')
        .eq('vendor_id', vendorId)
        .eq('member_user_id', user.id)
        .maybeSingle()
    if (existing.data?.id) {
        await serverSupabase
            .from('vendor_team_members')
            .update({
                full_name: fullName,
                phone: normalizedPhone || null,
                role: 'manager',
                status: 'active',
                updated_at: new Date().toISOString(),
            })
            .eq('id', existing.data.id)
        return
    }
    await serverSupabase.from('vendor_team_members').insert({
        vendor_id: vendorId,
        member_user_id: user.id,
        full_name: fullName,
        phone: normalizedPhone || null,
        role: 'manager',
        status: 'active',
    })
}

export async function POST(req: Request) {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    if (!token) {
        return NextResponse.json({ error: 'Authorization required. Pass Bearer token.' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json({ error: 'Server auth configuration missing' }, { status: 500 })
    }

    const anon = createClient(supabaseUrl, supabaseAnonKey)
    const {
        data: { user },
        error: authError,
    } = await anon.auth.getUser(token)
    if (authError || !user?.id) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as OnboardingPayload
    const businessName = String(body.business_name || '').trim()
    if (!businessName) {
        return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
    }

    const vendorId = await resolveOwnerVendorId(supabase, user)
    const phoneDb = normalizePhoneForDb(String(body.phone || ''))

    const { data: vendorRow, error: vendorError } = await supabase.from('vendors').upsert(
        {
            id: vendorId,
            business_name: businessName.substring(0, 100),
            category: String(body.category || '').trim() || null,
            phone: phoneDb || null,
            address: String(body.address || '').trim().substring(0, 300) || null,
            latitude: typeof body.latitude === 'number' ? body.latitude : null,
            longitude: typeof body.longitude === 'number' ? body.longitude : null,
            description: body.description ? String(body.description).substring(0, 1000) : null,
            logo_url: body.logo_url ? String(body.logo_url) : null,
            status: 'active',
            is_active: true,
        },
        { onConflict: 'id' }
    )
    .select('*')
    .maybeSingle()
    if (vendorError) {
        return NextResponse.json({ error: vendorError.message }, { status: 500 })
    }

    try {
        await ensureRequesterMembership(supabase, user, vendorId)
    } catch {
        // Membership linking is best-effort; vendor row save remains successful.
    }

    if (!body.has_services && body.service?.name && body.service?.price_amount != null) {
        const price = Number(body.service.price_amount)
        if (!Number.isNaN(price) && price > 0) {
            const { error: serviceError } = await supabase.from('services').insert({
                vendor_id: vendorId,
                name: String(body.service.name).trim().substring(0, 150),
                category: String(body.service.category || body.category || 'Service'),
                price_amount: Math.min(price, 9_999_999),
                image_urls: Array.isArray(body.service.image_urls)
                    ? body.service.image_urls.filter(Boolean).slice(0, 10)
                    : [],
                is_active: true,
            })
            if (serviceError) {
                return NextResponse.json({ error: serviceError.message }, { status: 500 })
            }
        }
    }

    const { count: serviceCount, error: serviceCountError } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
    if (serviceCountError) {
        return NextResponse.json({ error: serviceCountError.message }, { status: 500 })
    }

    return NextResponse.json({
        ok: true,
        vendor_id: vendorId,
        vendor: vendorRow ?? null,
        services: [],
        service_count: Number(serviceCount || 0),
    })
}
