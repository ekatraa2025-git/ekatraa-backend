import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractCityFromAddress } from '@/utils/addressParser'

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

    // Fetch categories to manually join (workaround for missing DB relationship)
    const { data: categories } = await supabase.from('vendor_categories').select('id, name')

    const categoriesMap = new Map(categories?.map(c => [c.id, c.name]) || [])

    const data = vendors.map(vendor => ({
        ...vendor,
        vendor_categories: {
            name: vendor.category_id ? categoriesMap.get(vendor.category_id) : null
        }
    }))

    return NextResponse.json(data)
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        
        // Extract admin-only flags and non-vendor fields before inserting into vendors table
        const createAuth = body.create_auth
        delete body.create_auth
        // Remove service catalog fields that are handled by the frontend separately
        delete body.service_subcategory
        delete body.service_stock_id
        delete body.service_stock_name
        delete body.service_pricing_type
        delete body.service_price_amount
        delete body.vendor_categories
        
        // Auto-extract city from address if city is not provided but address is
        if (body.address && !body.city) {
            const extractedCity = extractCityFromAddress(body.address)
            if (extractedCity) {
                body.city = extractedCity
            }
        }

        // If create_auth is enabled and phone is provided, create a Supabase auth user
        // so the vendor can log in via phone OTP in the mobile app
        let authUserId: string | null = null
        let authNote: string | null = null

        if (createAuth && body.phone) {
            // Normalize phone number to +91 format
            let phoneNumber = body.phone.replace(/\s/g, '')
            if (!phoneNumber.startsWith('+')) {
                phoneNumber = `+91${phoneNumber}`
            }

            try {
                // Create auth user with phone number using admin API (service role key)
                const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                    phone: phoneNumber,
                    phone_confirm: true,
                })

                if (authError) {
                    // If user already exists, try to find the existing user
                    if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
                        // List users and find by phone
                        const { data: existingUsers } = await supabase.auth.admin.listUsers()
                        const existingUser = existingUsers?.users?.find(
                            (u: any) => u.phone === phoneNumber
                        )
                        if (existingUser) {
                            authUserId = existingUser.id
                            authNote = `Vendor linked to existing auth account (phone: ${phoneNumber}). The vendor can log in using phone OTP.`
                        } else {
                            authNote = `Auth user creation skipped: ${authError.message}. You can manually set up authentication later.`
                        }
                    } else {
                        authNote = `Auth user creation failed: ${authError.message}. Vendor record created without login credentials.`
                    }
                } else if (authData?.user) {
                    authUserId = authData.user.id
                    authNote = `Auth account created successfully. Vendor can log in with phone: ${phoneNumber} using OTP.`
                }
            } catch (authCatchError: any) {
                authNote = `Auth user creation error: ${authCatchError.message}. Vendor record created without login credentials.`
            }
        }

        // If we got an auth user ID, use it as the vendor ID so they're linked
        if (authUserId) {
            body.id = authUserId
            body.user_id = authUserId
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
