import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/public/special-services
 * Global special add-ons (all occasions), priced like standard offerable_services.
 */
export async function GET() {
    try {
        const { data, error } = await supabase
            .from('offerable_services')
            .select(
                'id, category_id, name, description, image_url, display_order, price_min, price_max, price_unit, price_basic, price_classic_value, price_signature, price_prestige, price_royal, price_imperial, qty_label_basic, qty_label_classic_value, qty_label_signature, qty_label_prestige, qty_label_royal, qty_label_imperial, sub_variety_basic, sub_variety_classic_value, sub_variety_signature, sub_variety_prestige, sub_variety_royal, sub_variety_imperial, city, is_special_catalog'
            )
            .eq('is_active', true)
            .eq('is_special_catalog', true)
            .order('display_order', { ascending: true })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data ?? [])
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
