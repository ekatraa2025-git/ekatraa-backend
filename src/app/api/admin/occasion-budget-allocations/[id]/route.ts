import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/admin/occasion-budget-allocations/[id]
 */
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    if (!id) {
        return NextResponse.json({ error: 'Allocation id required' }, { status: 400 })
    }

    const { error } = await supabase
        .from('occasion_budget_allocations')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ deleted: true })
}
