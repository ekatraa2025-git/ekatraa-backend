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
import { RichTextEditor } from '@/components/Common/RichTextEditor'
import { toast } from 'sonner'

const TIER_LABELS = [
    { key: 'price_basic', label: 'Basic', qtyKey: 'qty_label_basic' },
    { key: 'price_classic_value', label: 'Classic Value', qtyKey: 'qty_label_classic_value' },
    { key: 'price_signature', label: 'Signature', qtyKey: 'qty_label_signature' },
    { key: 'price_prestige', label: 'Prestige', qtyKey: 'qty_label_prestige' },
    { key: 'price_royal', label: 'Royal', qtyKey: 'qty_label_royal' },
    { key: 'price_imperial', label: 'Imperial', qtyKey: 'qty_label_imperial' },
] as const

type Occasion = { id: string; name: string }
type Category = { id: string; name: string }

export default function EditOfferableServicePage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(false)
    const [occasions, setOccasions] = useState<Occasion[]>([])
    const [categoriesByOccasion, setCategoriesByOccasion] = useState<
        Record<string, Category[]>
    >({})
    const [form, setForm] = useState({
        occasion_id: '',
        category_id: '',
        name: '',
        description: '',
        display_order: 0,
        image_url: '',
        price_basic: '' as string,
        price_classic_value: '' as string,
        price_signature: '' as string,
        price_prestige: '' as string,
        price_royal: '' as string,
        price_imperial: '' as string,
        qty_label_basic: '' as string,
        qty_label_classic_value: '' as string,
        qty_label_signature: '' as string,
        qty_label_prestige: '' as string,
        qty_label_royal: '' as string,
        qty_label_imperial: '' as string,
        is_active: true,
        is_special_catalog: false,
    })
    const categories = form.occasion_id
        ? categoriesByOccasion[form.occasion_id] ?? []
        : []

    useEffect(() => {
        fetch('/api/admin/occasions')
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setOccasions(data)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        if (!form.occasion_id) return
        fetch(
            `/api/public/categories?occasion_id=${encodeURIComponent(form.occasion_id)}`,
        )
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data))
                    setCategoriesByOccasion((prev) => ({
                        ...prev,
                        [form.occasion_id]: data,
                    }))
            })
            .catch(() => {})
    }, [form.occasion_id])

    useEffect(() => {
        fetch(`/api/admin/offerable-services/${id}`)
            .then((r) => r.json())
            .then((serviceData) => {
                if (serviceData?.error) return
                const svc = serviceData as Record<string, unknown>
                const categoryId = (svc.category_id as string) ?? ''
                if (!categoryId) {
                    setForm({
                        occasion_id: '',
                        category_id: '',
                        name: (svc.name as string) ?? '',
                        description: (svc.description as string) ?? '',
                        display_order: Number(svc.display_order) ?? 0,
                        image_url: (svc.image_url as string) ?? '',
                        price_basic: svc.price_basic != null ? String(svc.price_basic) : '',
                        price_classic_value: svc.price_classic_value != null ? String(svc.price_classic_value) : '',
                        price_signature: svc.price_signature != null ? String(svc.price_signature) : '',
                        price_prestige: svc.price_prestige != null ? String(svc.price_prestige) : '',
                        price_royal: svc.price_royal != null ? String(svc.price_royal) : '',
                        price_imperial: svc.price_imperial != null ? String(svc.price_imperial) : '',
                        qty_label_basic: (svc.qty_label_basic as string) ?? '',
                        qty_label_classic_value: (svc.qty_label_classic_value as string) ?? '',
                        qty_label_signature: (svc.qty_label_signature as string) ?? '',
                        qty_label_prestige: (svc.qty_label_prestige as string) ?? '',
                        qty_label_royal: (svc.qty_label_royal as string) ?? '',
                        qty_label_imperial: (svc.qty_label_imperial as string) ?? '',
                        is_active: svc.is_active !== false,
                        is_special_catalog: svc.is_special_catalog === true,
                    })
                    return
                }
                fetch(
                    `/api/admin/occasion-categories?category_id=${encodeURIComponent(categoryId)}`,
                )
                    .then((r) => r.json())
                    .then((mappingData) => {
                        let occasionId = ''
                        if (
                            Array.isArray(mappingData) &&
                            mappingData.length > 0
                        ) {
                            const first = mappingData[0] as {
                                occasion_id?: string
                            }
                            occasionId = first.occasion_id ?? ''
                        }
                        setForm({
                            occasion_id: occasionId,
                            category_id: categoryId,
                            name: (svc.name as string) ?? '',
                            description: (svc.description as string) ?? '',
                            display_order: Number(svc.display_order) ?? 0,
                            image_url: (svc.image_url as string) ?? '',
                            price_basic: svc.price_basic != null ? String(svc.price_basic) : '',
                            price_classic_value: svc.price_classic_value != null ? String(svc.price_classic_value) : '',
                            price_signature: svc.price_signature != null ? String(svc.price_signature) : '',
                            price_prestige: svc.price_prestige != null ? String(svc.price_prestige) : '',
                            price_royal: svc.price_royal != null ? String(svc.price_royal) : '',
                            price_imperial: svc.price_imperial != null ? String(svc.price_imperial) : '',
                            qty_label_basic: (svc.qty_label_basic as string) ?? '',
                            qty_label_classic_value: (svc.qty_label_classic_value as string) ?? '',
                            qty_label_signature: (svc.qty_label_signature as string) ?? '',
                            qty_label_prestige: (svc.qty_label_prestige as string) ?? '',
                            qty_label_royal: (svc.qty_label_royal as string) ?? '',
                            qty_label_imperial: (svc.qty_label_imperial as string) ?? '',
                            is_active: svc.is_active !== false,
                            is_special_catalog: svc.is_special_catalog === true,
                        })
                        if (occasionId) {
                            fetch(
                                `/api/public/categories?occasion_id=${encodeURIComponent(occasionId)}`,
                            )
                                .then((r) => r.json())
                                .then((data) => {
                                    if (Array.isArray(data))
                                        setCategoriesByOccasion((prev) => ({
                                            ...prev,
                                            [occasionId]: data,
                                        }))
                                })
                                .catch(() => {})
                        }
                    })
            })
    }, [id])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.category_id) {
            toast.error('Select an occasion then a category')
            return
        }
        setLoading(true)
        const tierValues: Record<string, number | null> = {}
        TIER_LABELS.forEach(({ key }) => {
            const v = form[key as keyof typeof form]
            tierValues[key] = v !== '' && v != null ? Number(v) : null
        })
        const filledTiers = (Object.values(tierValues).filter(
            (x) => x != null && !Number.isNaN(x),
        ) as number[])
        const price_min =
            filledTiers.length > 0 ? Math.min(...filledTiers) : null
        const price_max =
            filledTiers.length > 0 ? Math.max(...filledTiers) : null
        const body = {
            category_id: form.category_id,
            name: form.name,
            description: form.description || null,
            display_order: form.display_order,
            image_url: form.image_url || null,
            is_active: form.is_active,
            is_special_catalog: form.is_special_catalog === true,
            price_min,
            price_max,
            qty_label_basic: form.qty_label_basic || null,
            qty_label_classic_value: form.qty_label_classic_value || null,
            qty_label_signature: form.qty_label_signature || null,
            qty_label_prestige: form.qty_label_prestige || null,
            qty_label_royal: form.qty_label_royal || null,
            qty_label_imperial: form.qty_label_imperial || null,
            ...tierValues,
        }
        const res = await fetch(`/api/admin/offerable-services/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        setLoading(false)
        if (data.error) toast.error(data.error)
        else router.push(form.is_special_catalog ? '/admin/special-services' : '/admin/offerable-services')
    }

    return (
        <DefaultLayout>
            <Card>
                <CardHeader>
                    <CardTitle>Edit Service</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Occasion</label>
                            <select
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={form.occasion_id}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        occasion_id: e.target.value,
                                        category_id: '',
                                    }))
                                }
                                required
                            >
                                <option value="">Select occasion first</option>
                                {occasions.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Category</label>
                            <select
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={form.category_id}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        category_id: e.target.value,
                                    }))
                                }
                                required
                                disabled={!form.occasion_id}
                            >
                                <option value="">
                                    {form.occasion_id
                                        ? 'Select category'
                                        : 'Select occasion first'}
                                </option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                className="mt-1"
                                value={form.name}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, name: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <RichTextEditor
                                value={form.description}
                                onChange={(html) =>
                                    setForm((p) => ({ ...p, description: html }))
                                }
                                placeholder="Service description..."
                                minHeight="120px"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Image (optional)</label>
                            <div className="mt-2 flex items-center gap-4">
                                {form.image_url && (
                                    <AdminImage
                                        url={form.image_url}
                                        alt="Service"
                                        className="h-20 w-20 rounded-lg object-cover border border-stroke dark:border-strokedark"
                                        placeholderClassName="h-20 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs"
                                    />
                                )}
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0]
                                            if (!file) return
                                            const url = await uploadFile(file, 'offerable-services')
                                            if (url) setForm((p) => ({ ...p, image_url: url }))
                                        }}
                                        className="w-full rounded-md border px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:text-white"
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                Pricing (tiers) — leave empty if not applicable. Qty label appears alongside the price (e.g. &quot;Upto 100&quot;, &quot;1 set&quot;).
                            </label>
                            <div className="space-y-2 rounded-md border p-3">
                                {TIER_LABELS.map(({ key, label, qtyKey }) => (
                                    <div
                                        key={key}
                                        className="flex items-center gap-3"
                                    >
                                        <label className="w-32 text-sm">
                                            {label}
                                        </label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            placeholder="₹"
                                            value={form[key]}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    [key]: e.target.value,
                                                }))
                                            }
                                            className="max-w-40"
                                        />
                                        <Input
                                            type="text"
                                            placeholder="e.g. Upto 100"
                                            value={form[qtyKey as keyof typeof form] as string}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    [qtyKey]: e.target.value,
                                                }))
                                            }
                                            className="max-w-48"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">
                                Display order
                            </label>
                            <Input
                                className="mt-1"
                                type="number"
                                value={form.display_order}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        display_order:
                                            Number(e.target.value) || 0,
                                    }))
                                }
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_special_catalog_edit"
                                checked={form.is_special_catalog}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        is_special_catalog: e.target.checked,
                                    }))
                                }
                            />
                            <label htmlFor="is_special_catalog_edit">Special catalog (all occasions)</label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={form.is_active}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        is_active: e.target.checked,
                                    }))
                                }
                            />
                            <label htmlFor="is_active">Active</label>
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Save
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </DefaultLayout>
    )
}
