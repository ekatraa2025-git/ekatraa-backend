import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { data, error } = await supabase
        .from('services')
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
        
        // Remove category if it's empty or undefined to avoid NOT NULL constraint
        if (body.category === '' || body.category === undefined) {
            delete body.category
        }
        
        // Remove price_amount if it's empty or undefined to avoid NOT NULL constraint
        if (body.price_amount === '' || body.price_amount === undefined || body.price_amount === null) {
            delete body.price_amount
        }
        
        const { data, error } = await supabase
            .from('services')
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
        .from('services')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
}
