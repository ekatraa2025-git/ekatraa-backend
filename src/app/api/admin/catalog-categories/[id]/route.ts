import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(data)
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const body = await req.json()
    const { data, error } = await supabase
        .from('categories')
        .update(body)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json(data)
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    // Cascade: delete offerable_services linked to this category
    const { error: svcErr } = await supabase
        .from('offerable_services')
        .delete()
        .eq('category_id', id)
    if (svcErr) {
        return NextResponse.json({ error: svcErr.message }, { status: 500 })
    }

    // Cascade: delete occasion_categories links
    const { error: ocErr } = await supabase
        .from('occasion_categories')
        .delete()
        .eq('category_id', id)
    if (ocErr) {
        return NextResponse.json({ error: ocErr.message }, { status: 500 })
    }

    const { error } = await supabase.from('categories').delete().eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ deleted: true })
}
