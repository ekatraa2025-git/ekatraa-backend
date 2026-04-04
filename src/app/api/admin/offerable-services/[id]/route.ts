import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { data, error } = await supabase
        .from('offerable_services')
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
    const occasionIds: string[] | undefined = Array.isArray(body.occasion_ids)
        ? body.occasion_ids.filter((x: unknown) => typeof x === 'string')
        : undefined
    const replaceOccasions = body.replace_occasion_links === true
    delete body.occasion_ids
    delete body.replace_occasion_links

    const { data, error } = await supabase
        .from('offerable_services')
        .update(body)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (occasionIds && replaceOccasions) {
        await supabase.from('service_occasions').delete().eq('service_id', id)
        if (occasionIds.length > 0) {
            const rows = occasionIds.map((occasion_id) => ({ occasion_id, service_id: id }))
            const { error: soErr } = await supabase.from('service_occasions').insert(rows)
            if (soErr) {
                return NextResponse.json(
                    { error: 'Updated service but occasion links failed: ' + soErr.message, ...data },
                    { status: 500 }
                )
            }
        }
    }

    return NextResponse.json(data)
}

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { error } = await supabase.from('offerable_services').delete().eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ deleted: true })
}
