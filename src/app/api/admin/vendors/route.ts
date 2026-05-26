import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractCityFromAddress } from '@/utils/addressParser'
import { pickVendorPayload } from '@/lib/vendor-fields'
import { applyResolvedVendorCategory, resolveVendorCategoryIdForDb } from '@/lib/vendor-category-resolve'

function normalizePhoneDigits(raw: unknown): string {
    const digits = String(raw ?? '').replace(/\D/g, '')
    if (digits.length >= 10) return digits.slice(-10)
    return digits
}

function toE164IndiaPhone(raw: unknown): string | null {
    const digits = normalizePhoneDigits(raw)
    if (digits.length !== 10) return null
    return `+91${digits}`
}

async function findAuthUserIdByPhone(
    client: SupabaseClient,
    phoneNumber: string
): Promise<string | null> {
    let page = 1
    const perPage = 200
    for (;;) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage })
        if (error || !data?.users?.length) break
        const hit = data.users.find((u) => u.phone === phoneNumber)
        if (hit?.id) return hit.id
        if (data.users.length < perPage) break
        page += 1
        if (page > 50) break
    }
    return null
}

function normalizeName(value: unknown): string {
    return String(value || '').trim().toLowerCase()
}

function formatVendorLocation(vendor: Record<string, any>): string {
    const serviceArea = String(vendor.service_area || '').trim()
    if (serviceArea) return serviceArea
    const city = String(vendor.city || '').trim()
    const state = String(vendor.state || '').trim()
    return [city, state].filter(Boolean).join(', ')
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    let query = supabase
        .from('vendors')
        .select('*')

    if (status) {
        query = query.eq('status', status)
    }

    const { data: vendors, error } = await query.order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Resolve category name from catalog categories (categories table)
    const { data: catalogCategories } = await supabase.from('categories').select('id, name')
    const categoriesMap = new Map(catalogCategories?.map(c => [c.id, c.name]) || [])

    const data = vendors.map((vendor) => {
        const fromCatalogById =
            vendor.category_id != null ? categoriesMap.get(vendor.category_id as string) : null
        const fromCatalogByName =
            !fromCatalogById && vendor.category
                ? (catalogCategories || []).find((c) => normalizeName(c.name) === normalizeName(vendor.category))?.name
                : null
        const displayCategory =
            (fromCatalogById && String(fromCatalogById).trim()) ||
            (fromCatalogByName && String(fromCatalogByName).trim()) ||
            (vendor.category && String(vendor.category).trim()) ||
            null
        const locationDisplay = formatVendorLocation(vendor)
        return {
            ...vendor,
            phone: vendor.phone || vendor.mobile || '',
            location_display: locationDisplay,
            vendor_categories: {
                name: displayCategory,
            },
        }
    })

    return NextResponse.json(data)
}

export async function POST(req: Request) {
    try {
        const raw = await req.json()
        const body = pickVendorPayload(raw) as Record<string, unknown>
        
        // Extract admin-only flags and non-vendor fields before inserting into vendors table
        const createAuth = raw.create_auth !== false
        delete (raw as Record<string, unknown>).create_auth
        // Remove service catalog fields that are handled by the frontend separately
        delete body.service_subcategory
        delete body.service_stock_id
        delete body.service_stock_name
        delete body.service_pricing_type
        delete body.service_price_amount
        delete body.vendor_categories
        
        // Auto-extract city from address if city is not provided but address is
        if (body.address && !body.city) {
            const extractedCity = extractCityFromAddress(String(body.address))
            if (extractedCity) {
                body.city = extractedCity
            }
        }

        if (body.status !== undefined) {
            body.is_active = body.status === 'active'
        } else if (body.is_active !== undefined) {
            body.status = body.is_active ? 'active' : 'pending'
        }

        const wantsCategory =
            (body.category_id != null && String(body.category_id).trim() !== '') ||
            (body.category != null && String(body.category).trim() !== '')
        if (wantsCategory) {
            const { id: resolvedCatId, name: resolvedCatName, reason: catReason } =
                await resolveVendorCategoryIdForDb(supabase, body.category_id, body.category)
            if (!resolvedCatId) {
                return NextResponse.json(
                    { error: catReason || 'Invalid category', auth_note: null },
                    { status: 400 }
                )
            }
            applyResolvedVendorCategory(body, { id: resolvedCatId, name: resolvedCatName || String(body.category || '') })
        }

        // vendors.id must equal auth.users.id (FK). Create or link auth before insert.
        let authUserId: string | null = null
        let authNote: string | null = null

        if (createAuth) {
            const phoneNumber = toE164IndiaPhone(body.phone)
            if (!phoneNumber) {
                return NextResponse.json(
                    {
                        error: 'A valid 10-digit phone number is required to create a vendor login account.',
                        auth_note: null,
                    },
                    { status: 400 }
                )
            }

            body.phone = normalizePhoneDigits(body.phone)

            try {
                const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                    phone: phoneNumber,
                    phone_confirm: true,
                    email: body.email ? String(body.email).trim().toLowerCase() : undefined,
                    email_confirm: body.email ? true : undefined,
                })

                if (authError) {
                    const duplicate =
                        authError.message?.includes('already been registered') ||
                        authError.message?.includes('already exists') ||
                        authError.message?.includes('already registered')

                    if (duplicate) {
                        authUserId = await findAuthUserIdByPhone(supabase, phoneNumber)
                        if (authUserId) {
                            authNote = `Vendor linked to existing auth account (phone: ${phoneNumber}). The vendor can log in using phone OTP.`
                        } else {
                            return NextResponse.json(
                                {
                                    error: `Phone ${phoneNumber} is already registered but could not be linked. Try a different number or contact support.`,
                                    auth_note: null,
                                },
                                { status: 400 }
                            )
                        }
                    } else {
                        return NextResponse.json(
                            {
                                error: `Could not create vendor login: ${authError.message}`,
                                auth_note: null,
                            },
                            { status: 400 }
                        )
                    }
                } else if (authData?.user?.id) {
                    authUserId = authData.user.id
                    authNote = `Auth account created successfully. Vendor can log in with phone: ${phoneNumber} using OTP.`
                }
            } catch (authCatchError: unknown) {
                const message = authCatchError instanceof Error ? authCatchError.message : 'Unknown auth error'
                return NextResponse.json(
                    { error: `Could not create vendor login: ${message}`, auth_note: null },
                    { status: 400 }
                )
            }
        } else {
            return NextResponse.json(
                {
                    error: 'Vendor profiles require a Supabase auth account. Enable "Create Auth Account" and provide a phone number.',
                    auth_note: null,
                },
                { status: 400 }
            )
        }

        if (!authUserId) {
            return NextResponse.json(
                { error: 'Could not resolve vendor auth user id.', auth_note: authNote },
                { status: 400 }
            )
        }

        body.id = authUserId

        const { data: existingVendor } = await supabase
            .from('vendors')
            .select('id')
            .eq('id', authUserId)
            .maybeSingle()

        if (existingVendor) {
            return NextResponse.json(
                {
                    error: 'A vendor profile already exists for this phone/auth account.',
                    auth_note: authNote,
                },
                { status: 409 }
            )
        }

        const { data, error } = await supabase
            .from('vendors')
            .insert([body])
            .select()
            .single()

        if (error) {
            // If vendor insert fails but we created an auth user, we should still report the error
            // but not delete the auth user as it can be reused
            return NextResponse.json({ error: error.message, auth_note: authNote }, { status: 400 })
        }

        return NextResponse.json({ ...data, auth_note: authNote }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
