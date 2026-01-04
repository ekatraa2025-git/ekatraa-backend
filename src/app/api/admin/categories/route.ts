import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    const { data, error } = await supabase
        .from('vendor_categories')
        .select('*')
        .order('name', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { data, error } = await supabase
            .from('vendor_categories')
            .insert([body])
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json(data, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
