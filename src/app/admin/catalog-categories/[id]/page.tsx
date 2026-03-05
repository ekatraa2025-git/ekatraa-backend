'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { uploadFile } from '@/utils/storage'
import { AdminImage } from '@/components/Common/AdminImage'
import { toast } from 'sonner'

type Occasion = { id: string; name: string }

export default function EditCatalogCategoryPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ name: '', display_order: 0, is_active: true, icon_url: '' })
    const [occasions, setOccasions] = useState<Occasion[]>([])
    const [selectedOccasionIds, setSelectedOccasionIds] = useState<string[]>([])
    const [initialOccasionIds, setInitialOccasionIds] = useState<string[]>([])

    useEffect(() => {
        // Load category core fields
        fetch(`/api/admin/catalog-categories/${id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data && !data.error)
                    setForm({
                        name: data.name ?? '',
                        display_order: data.display_order ?? 0,
                        is_active: data.is_active !== false,
                        icon_url: data.icon_url ?? '',
                    })
            })

        // Load all occasions
        fetch('/api/admin/occasions')
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setOccasions(data)
            })
            .catch(() => {
                // ignore fetch errors for occasions
            })

        // Load existing occasion mappings for this category
        fetch(`/api/admin/occasion-categories?category_id=${id}`)
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    const occIds = data.map((row: { occasion_id: string }) => row.occasion_id)
                    setSelectedOccasionIds(occIds)
                    setInitialOccasionIds(occIds)
                }
            })
            .catch(() => {
                // ignore mapping fetch errors; category can still be edited
            })
    }, [id])

    const toggleOccasion = (occId: string) => {
        setSelectedOccasionIds((prev) =>
            prev.includes(occId) ? prev.filter((x) => x !== occId) : [...prev, occId],
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await fetch(`/api/admin/catalog-categories/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const data = await res.json()
        if (data.error) {
            setLoading(false)
            toast.error(data.error)
            return
        }

        // Sync occasion_categories for this category based on selectedOccasionIds
        const toAdd = selectedOccasionIds.filter((o) => !initialOccasionIds.includes(o))
        const toRemove = initialOccasionIds.filter((o) => !selectedOccasionIds.includes(o))

        try {
            await Promise.all([
                ...toAdd.map((occasion_id) =>
                    fetch('/api/admin/occasion-categories', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ occasion_id, category_id: id }),
                    }).then((r) => r.json()),
                ),
                ...toRemove.map((occasion_id) =>
                    fetch(
                        `/api/admin/occasion-categories?occasion_id=${encodeURIComponent(
                            occasion_id,
                        )}&category_id=${encodeURIComponent(id)}`,
                        {
                            method: 'DELETE',
                        },
                    ).then((r) => r.json()),
                ),
            ])
        } catch {
            // Do not block save on mapping errors; they can be retried later
        }

        setLoading(false)
        router.push('/admin/catalog-categories')
    }

    return (
        <DefaultLayout>
            <Card>
                <CardHeader>
                    <CardTitle>Edit Catalog Category: {id}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                className="mt-1"
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Icon image (optional)</label>
                            <div className="mt-2 flex items-center gap-4">
                                {form.icon_url && (
                                    <AdminImage
                                        url={form.icon_url}
                                        alt="Category icon"
                                        className="h-16 w-16 rounded-lg object-cover border border-stroke dark:border-strokedark"
                                        placeholderClassName="h-16 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs"
                                    />
                                )}
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0]
                                            if (!file) return
                                            const url = await uploadFile(file, 'catalog-categories')
                                            if (url) setForm((p) => ({ ...p, icon_url: url }))
                                        }}
                                        className="w-full rounded-md border px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:text-white"
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Display order</label>
                            <Input
                                className="mt-1"
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
                            <label htmlFor="is_active">Active</label>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Occasions</label>
                            <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-md border px-3 py-2">
                                {occasions.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        No occasions configured yet. You can add them from the Occasions screen.
                                    </p>
                                )}
                                {occasions.map((o) => (
                                    <label
                                        key={o.id}
                                        className="flex cursor-pointer items-center gap-2 text-sm"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedOccasionIds.includes(o.id)}
                                            onChange={() => toggleOccasion(o.id)}
                                        />
                                        <span>{o.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </DefaultLayout>
    )
}
