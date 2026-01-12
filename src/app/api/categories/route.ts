import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Public endpoint for mobile app to fetch categories
export async function GET() {
    const { data, error } = await supabase
        .from('vendor_categories')
        .select('id, name')
        .order('name', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
}
