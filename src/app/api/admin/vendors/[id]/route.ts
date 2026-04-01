import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractCityFromAddress } from '@/utils/addressParser'
import { pickVendorPayload } from '@/lib/vendor-fields'
import { notifyVendorActivated } from '@/lib/notifications'

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_RE.test(value.trim())
}

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
        const raw = await req.json()
        const body = pickVendorPayload(raw as Record<string, unknown>) as Record<string, unknown>

        // Catalog categories use string slugs (e.g. "menu"); vendors.category_id is UUID (legacy FK)
        if (body.category_id !== undefined && !isUuid(body.category_id)) {
            delete body.category_id
        }
        delete body.id

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
                const extractedCity = extractCityFromAddress(String(body.address))
                if (extractedCity) {
                    body.city = extractedCity
                }
            }
        }

        // Sync aadhaar_verified with is_verified if is_verified is being updated
        if (body.is_verified !== undefined) {
            body.aadhaar_verified = body.is_verified
        }

        // Keep is_active and status in sync
        if (body.status !== undefined) {
            body.is_active = body.status === 'active'
        } else if (body.is_active !== undefined) {
            body.status = body.is_active ? 'active' : 'pending'
        }

        const { data: prev } = await supabase
            .from('vendors')
            .select('status, business_name')
            .eq('id', id)
            .maybeSingle()

        const wasInactive = prev?.status !== 'active'

        const { data, error } = await supabase
            .from('vendors')
            .update(body)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        const nowActive = data?.status === 'active'
        if (wasInactive && nowActive) {
            notifyVendorActivated(id, String(data?.business_name || prev?.business_name || 'Vendor')).catch(
                (e) => console.error('notifyVendorActivated:', e)
            )
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
