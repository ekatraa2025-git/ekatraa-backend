import { supabase } from '@/lib/supabase/server'
import { resolveVendorCategoryIdForDb } from '@/lib/vendor-category-resolve'
import { NextResponse } from 'next/server'

function normalizePhoneDigits(raw: string): string {
    const d = raw.replace(/\D/g, '')
    return d.length >= 10 ? d.slice(-10) : d.padStart(10, '0').slice(-10)
}

async function findUserIdByEmail(email: string): Promise<string | null> {
    const normalized = email.trim().toLowerCase()
    let page = 1
    const perPage = 200
    for (;;) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
        if (error || !data?.users?.length) break
        const hit = data.users.find((u) => u.email?.toLowerCase() === normalized)
        if (hit?.id) return hit.id
        if (data.users.length < perPage) break
        page += 1
        if (page > 50) break
    }
    return null
}

/**
 * Ensures a demo/default vendor auth user + vendors row exist (idempotent).
 * Configure via DEFAULT_VENDOR_EMAIL, DEFAULT_VENDOR_PASSWORD, DEFAULT_VENDOR_PHONE (10 digits, optional).
 */
export async function POST() {
    try {
        const email = (process.env.DEFAULT_VENDOR_EMAIL || 'vendor@ekatraa.dev').trim().toLowerCase()
        const password = process.env.DEFAULT_VENDOR_PASSWORD || 'VendorDemo123!'
        const phoneDigits = normalizePhoneDigits(process.env.DEFAULT_VENDOR_PHONE || '9876543210')
        const fullPhone = `+91${phoneDigits}`

        const { data: catRow } = await supabase
            .from('categories')
            .select('id,name')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .limit(1)
            .maybeSingle()

        const { id: categoryId } = await resolveVendorCategoryIdForDb(
            supabase,
            catRow?.id ?? null,
            catRow?.name ?? null
        )
        const categoryName = catRow?.name ?? 'Venue'

        let userId = await findUserIdByEmail(email)
        let authCreated = false

        if (!userId) {
            const { data: created, error: createErr } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                phone: fullPhone,
                phone_confirm: true,
            })
            if (createErr || !created?.user?.id) {
                return NextResponse.json(
                    { error: createErr?.message || 'Failed to create auth user for default vendor.' },
                    { status: 400 }
                )
            }
            userId = created.user.id
            authCreated = true
        }

        const { data: existingVendor } = await supabase.from('vendors').select('id').eq('id', userId).maybeSingle()

        if (existingVendor) {
            return NextResponse.json({
                ok: true,
                alreadyExists: true,
                authCreated,
                userId,
                email,
                phone: phoneDigits,
                message: 'Default vendor already present.',
            })
        }

        const vendorRow: Record<string, unknown> = {
            id: userId,
            business_name: 'Default Vendor',
            owner_name: 'Demo Owner',
            email,
            phone: phoneDigits,
            address: 'Demo address — replace in admin',
            city: 'Bhubaneswar',
            state: 'Odisha',
            service_area: 'Odisha',
            description: 'Default demo vendor for testing login (OTP + email).',
            status: 'active',
            is_active: true,
            category: categoryName,
        }
        if (categoryId) {
            vendorRow.category_id = categoryId
        }

        const { error: insertErr } = await supabase.from('vendors').insert([vendorRow])

        if (insertErr) {
            return NextResponse.json(
                { error: insertErr.message, userId, hint: 'Auth user may exist without vendor row; fix data manually.' },
                { status: 400 }
            )
        }

        return NextResponse.json({
            ok: true,
            alreadyExists: false,
            authCreated,
            userId,
            email,
            password: authCreated ? password : undefined,
            phone: phoneDigits,
            message: authCreated
                ? 'Default vendor auth user and vendor profile created.'
                : 'Vendor profile created for existing auth user (password unchanged).',
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
