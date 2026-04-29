'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { uploadFile } from '@/utils/storage'
import { AdminImage } from '@/components/Common/AdminImage'

type BudgetAllocationRow = { category_id: string; percentage: number; display_order: number }

export default function EditOccasionPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [form, setForm] = useState({ name: '', image_url: '', display_order: 0, is_active: true })

    const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
    const [allocations, setAllocations] = useState<BudgetAllocationRow[]>([])
    const [allocLoading, setAllocLoading] = useState(false)
    const [allocSaving, setAllocSaving] = useState(false)

    useEffect(() => {
        fetch(`/api/admin/occasions/${id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data && !data.error) setForm({
                    name: data.name ?? '',
                    image_url: data.image_url ?? '',
                    display_order: data.display_order ?? 0,
                    is_active: data.is_active !== false,
                })
            })
    }, [id])

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const url = await uploadFile(file, 'occasions')
        setUploading(false)
        if (url) setForm((p) => ({ ...p, image_url: url }))
    }

    useEffect(() => {
        setAllocLoading(true)
        Promise.all([
            fetch(`/api/public/categories?occasion_id=${encodeURIComponent(id)}`).then((r) => r.json()),
            fetch(`/api/admin/occasion-budget-allocations?occasion_id=${encodeURIComponent(id)}`).then((r) => r.json()),
        ])
            .then(([catData, allocData]) => {
                const cats = Array.isArray(catData) ? catData : (catData as { error?: string }).error ? [] : []
                const allocs = Array.isArray(allocData) ? allocData : []
                setCategories(cats)
                setAllocations(
                    allocs.length > 0
                        ? allocs.map((a: { category_id: string; percentage: number; display_order?: number }) => ({
                              category_id: a.category_id,
                              percentage: Number(a.percentage),
                              display_order: a.display_order ?? 0,
                          }))
                        : []
                )
            })
            .catch((err) => toast.error(String(err)))
            .finally(() => setAllocLoading(false))
    }, [id])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await fetch(`/api/admin/occasions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const data = await res.json()
        setLoading(false)
        if (data.error) toast.error(data.error)
        else router.push('/admin/occasions')
    }

    const sumPercent = allocations.reduce((s, a) => s + Number(a.percentage), 0)
    const sumWarn = Math.abs(sumPercent - 100) > 0.01

    const addAllocRow = () => {
        const used = new Set(allocations.map((a) => a.category_id))
        const next = categories.find((c) => !used.has(c.id))
        if (next) {
            setAllocations((p) => [...p, { category_id: next.id, percentage: 0, display_order: p.length }])
        } else {
            toast.info('All categories already allocated')
        }
    }

    const updateAlloc = (idx: number, upd: Partial<BudgetAllocationRow>) => {
        setAllocations((p) => p.map((a, i) => (i === idx ? { ...a, ...upd } : a)))
    }

    const removeAlloc = (idx: number) => {
        setAllocations((p) => p.filter((_, i) => i !== idx))
    }

    const saveAllocations = async () => {
        if (sumWarn) {
            toast.error('Total must be 100%')
            return
        }
        setAllocSaving(true)
        const res = await fetch('/api/admin/occasion-budget-allocations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                occasion_id: id,
                allocations: allocations.map((a, i) => ({
                    category_id: a.category_id,
                    percentage: a.percentage,
                    display_order: i,
                })),
            }),
        })
        const data = await res.json()
        setAllocSaving(false)
        if (data.error) toast.error(data.error)
        else toast.success('Budget allocations saved')
    }

    return (
        <DefaultLayout>
            <Card>
                <CardHeader>
                    <CardTitle>Edit Occasion: {id}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Occasion image</label>
                            <div className="flex items-center gap-3">
                                <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
                                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                            </div>
                            {form.image_url ? (
                                <AdminImage
                                    url={form.image_url}
                                    alt="Occasion preview"
                                    className="mt-2 h-20 w-28 rounded-md object-cover"
                                    placeholderClassName="mt-2 h-20 w-28 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs"
                                />
                            ) : null}
                            <Input
                                className="mt-2"
                                value={form.image_url}
                                onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                                placeholder="Or paste image URL"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Display order</label>
                            <Input
                                type="number"
                                value={form.display_order}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, display_order: Number(e.target.value) || 0 }))
                                }
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={form.is_active}
                                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                            />
                            <label htmlFor="is_active" className="text-sm font-medium">Active</label>
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Budget Allocation</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Assign percentage per category for recommendation algorithm. Total should be 100%.
                    </p>
                </CardHeader>
                <CardContent>
                    {allocLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading…
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 space-y-2">
                                {allocations.map((a, idx) => (
                                    <div key={idx} className="flex flex-wrap items-center gap-2">
                                        <select
                                            className="rounded-md border px-3 py-2 text-sm min-w-[180px]"
                                            value={a.category_id}
                                            onChange={(e) =>
                                                updateAlloc(idx, { category_id: e.target.value })
                                            }
                                        >
                                            {categories
                                                .filter(
                                                    (c) =>
                                                        c.id === a.category_id ||
                                                        !allocations.some(
                                                            (o, i) => i !== idx && o.category_id === c.id
                                                        )
                                                )
                                                .map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name}
                                                    </option>
                                                ))}
                                        </select>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.1}
                                            className="w-24"
                                            value={a.percentage || ''}
                                            onChange={(e) =>
                                                updateAlloc(idx, {
                                                    percentage: Number(e.target.value) || 0,
                                                })
                                            }
                                            placeholder="%"
                                        />
                                        <span className="text-sm">%</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeAlloc(idx)}
                                            aria-label="Remove"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-4">
                                <Button type="button" variant="outline" size="sm" onClick={addAllocRow}>
                                    <Plus className="mr-1 h-4 w-4" />
                                    Add row
                                </Button>
                                <Button
                                    type="button"
                                    onClick={saveAllocations}
                                    disabled={allocSaving || allocations.length === 0}
                                >
                                    {allocSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save allocations
                                </Button>
                                {sumWarn && allocations.length > 0 && (
                                    <span className="text-sm text-amber-600">
                                        Total: {sumPercent.toFixed(1)}% (should be 100%)
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </DefaultLayout>
    )
}
