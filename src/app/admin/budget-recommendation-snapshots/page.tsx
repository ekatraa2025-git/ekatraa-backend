'use client'

import React, { useCallback, useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Search } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'

type SnapshotRow = {
    id: string
    created_at: string
    cart_id: string | null
    user_id: string | null
    occasion_id: string
    contact_name: string | null
    contact_mobile: string | null
    contact_email: string | null
    budget_inr: number
    form_snapshot: unknown
    category_percentages: unknown
    recommendation_payload: unknown
    ai_narrative: unknown
    ai_meta: unknown
}

export default function BudgetRecommendationSnapshotsPage() {
    const [items, setItems] = useState<SnapshotRow[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [q, setQ] = useState('')
    const [search, setSearch] = useState('')
    const [detail, setDetail] = useState<SnapshotRow | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams({ limit: '50', offset: '0' })
        if (search.trim()) params.set('q', search.trim())
        const r = await fetch(`/api/admin/budget-recommendation-snapshots?${params}`)
        const data = await r.json()
        if (!data.error) {
            setItems(data.items ?? [])
            setTotal(data.total ?? 0)
        }
        setLoading(false)
    }, [search])

    useEffect(() => {
        load()
    }, [load])

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-7xl p-4 md:p-8">
                <h1 className="text-2xl font-bold tracking-tight mb-2">Budget &amp; recommendation snapshots</h1>
                <p className="text-muted-foreground text-sm mb-6">
                    Customer-submitted event forms, budgets, recommendation results, and optional AI narrative.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Search name or mobile…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && setSearch(q)}
                        />
                    </div>
                    <Button variant="secondary" onClick={() => setSearch(q)}>
                        Search
                    </Button>
                    <Button variant="outline" onClick={load} disabled={loading}>
                        Refresh
                    </Button>
                </div>

                {loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground mb-4">{total} snapshot(s)</p>
                        <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-3 font-semibold">When</th>
                                        <th className="text-left p-3 font-semibold">Contact</th>
                                        <th className="text-left p-3 font-semibold">Mobile</th>
                                        <th className="text-left p-3 font-semibold">Occasion</th>
                                        <th className="text-right p-3 font-semibold">Budget (INR)</th>
                                        <th className="text-left p-3 font-semibold" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((row) => (
                                        <tr key={row.id} className="border-t border-border hover:bg-muted/30">
                                            <td className="p-3 whitespace-nowrap">
                                                {row.created_at
                                                    ? new Date(row.created_at).toLocaleString('en-IN')
                                                    : '—'}
                                            </td>
                                            <td className="p-3">{row.contact_name || '—'}</td>
                                            <td className="p-3 font-mono text-xs">{row.contact_mobile || '—'}</td>
                                            <td className="p-3">{row.occasion_id}</td>
                                            <td className="p-3 text-right">
                                                {row.budget_inr != null ? Number(row.budget_inr).toLocaleString('en-IN') : '—'}
                                            </td>
                                            <td className="p-3">
                                                <Button variant="ghost" size="sm" onClick={() => setDetail(row)}>
                                                    View JSON
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {items.length === 0 && (
                                <p className="p-8 text-center text-muted-foreground">No snapshots yet.</p>
                            )}
                        </div>
                    </>
                )}
            </div>

            <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
                <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col">
                    <SheetHeader>
                        <SheetTitle>Snapshot {detail?.id}</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="flex-1 min-h-0 mt-4 rounded-md border p-4">
                        <pre className="text-xs whitespace-pre-wrap break-words">
                            {detail
                                ? JSON.stringify(
                                      {
                                          id: detail.id,
                                          created_at: detail.created_at,
                                          cart_id: detail.cart_id,
                                          user_id: detail.user_id,
                                          occasion_id: detail.occasion_id,
                                          contact_name: detail.contact_name,
                                          contact_mobile: detail.contact_mobile,
                                          contact_email: detail.contact_email,
                                          budget_inr: detail.budget_inr,
                                          form_snapshot: detail.form_snapshot,
                                          category_percentages: detail.category_percentages,
                                          recommendation_payload: detail.recommendation_payload,
                                          ai_narrative: detail.ai_narrative,
                                          ai_meta: detail.ai_meta,
                                      },
                                      null,
                                      2
                                  )
                                : ''}
                        </pre>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </DefaultLayout>
    )
}
