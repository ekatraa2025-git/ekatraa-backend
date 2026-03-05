'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { uploadFile } from '@/utils/storage'
import { AdminImage } from '@/components/Common/AdminImage'
import { toast } from 'sonner'

type Occasion = { id: string; name: string }

export default function NewCatalogCategoryPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ id: '', name: '', display_order: 0, icon_url: '' })
    const [occasions, setOccasions] = useState<Occasion[]>([])
    const [selectedOccasionIds, setSelectedOccasionIds] = useState<string[]>([])

    useEffect(() => {
        fetch('/api/admin/occasions')
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setOccasions(data)
            })
            .catch(() => {
                // ignore fetch errors; occasions list is optional at creation time
            })
    }, [])

    const toggleOccasion = (id: string) => {
        setSelectedOccasionIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await fetch('/api/admin/catalog-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const data = await res.json()
        if (data.error) {
            setLoading(false)
            toast.error(data.error)
            return
        }

        // Map this category to selected occasions via occasion_categories
        if (selectedOccasionIds.length > 0 && data.id) {
            try {
                await Promise.all(
                    selectedOccasionIds.map((occasion_id) =>
                        fetch('/api/admin/occasion-categories', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ occasion_id, category_id: data.id }),
                        }).then((r) => r.json()),
                    ),
                )
            } catch {
                // Soft-fail: mapping errors should not block category creation
            }
        }

        setLoading(false)
        router.push('/admin/catalog-categories')
    }

    return (
        <DefaultLayout>
            <Card>
                <CardHeader>
                    <CardTitle>Add Catalog Category</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">ID (slug)</label>
                            <Input
                                className="mt-1"
                                value={form.id}
                                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                                placeholder="e.g. venue"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                className="mt-1"
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="Venue"
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
                        <div>
                            <label className="text-sm font-medium">Occasions</label>
                            <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-md border px-3 py-2">
                                {occasions.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Configure occasions first. You can also link this category later from edit.
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
                            Create
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </DefaultLayout>
    )
}
