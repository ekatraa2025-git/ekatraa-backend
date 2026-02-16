import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractCityFromAddress } from '@/utils/addressParser'

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await req.json()

        // Remove non-vendor fields that might be sent from the form
        delete body.service_subcategory
        delete body.service_stock_id
        delete body.service_stock_name
        delete body.service_pricing_type
        delete body.service_price_amount
        delete body.vendor_categories
        delete body.create_auth
        
        // Auto-extract city from address if address is being updated and city is not explicitly provided
        if (body.address !== undefined) {
            // If address is being updated but city is not in the update, extract it
            if (!body.city) {
                const extractedCity = extractCityFromAddress(body.address)
                if (extractedCity) {
                    body.city = extractedCity
                }
            }
        }

        // Sync aadhaar_verified with is_verified if is_verified is being updated
        if (body.is_verified !== undefined) {
            body.aadhaar_verified = body.is_verified
        }
        
        const { data, error } = await supabase
            .from('vendors')
            .update(body)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
}
