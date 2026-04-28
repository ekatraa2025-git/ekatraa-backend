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
    { key: 'price_basic', label: 'Basic', qtyKey: 'qty_label_basic', subKey: 'sub_variety_basic' },
    { key: 'price_classic_value', label: 'Classic Value', qtyKey: 'qty_label_classic_value', subKey: 'sub_variety_classic_value' },
    { key: 'price_signature', label: 'Signature', qtyKey: 'qty_label_signature', subKey: 'sub_variety_signature' },
    { key: 'price_prestige', label: 'Prestige', qtyKey: 'qty_label_prestige', subKey: 'sub_variety_prestige' },
    { key: 'price_royal', label: 'Royal', qtyKey: 'qty_label_royal', subKey: 'sub_variety_royal' },
    { key: 'price_imperial', label: 'Imperial', qtyKey: 'qty_label_imperial', subKey: 'sub_variety_imperial' },
] as const

type Occasion = { id: string; name: string }
type Category = { id: string; name: string }

function toggleId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function hasAllSelected(selectedIds: string[], allIds: string[]): boolean {
    return allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))
}

export default function EditOfferableServicePage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(false)
    const [occasions, setOccasions] = useState<Occasion[]>([])
    const [vendors, setVendors] = useState<{ id: string; business_name: string }[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [form, setForm] = useState({
        occasion_ids: [] as string[],
        vendor_ids: [] as string[],
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
        sub_variety_basic: '' as string,
        sub_variety_classic_value: '' as string,
        sub_variety_signature: '' as string,
        sub_variety_prestige: '' as string,
        sub_variety_royal: '' as string,
        sub_variety_imperial: '' as string,
        is_active: true,
        is_special_catalog: false,
    })

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/occasions').then((r) => r.json()),
            fetch('/api/admin/vendors?status=active').then((r) => r.json()),
        ])
            .then(([occData, venData]) => {
                if (Array.isArray(occData)) setOccasions(occData)
                if (Array.isArray(venData)) setVendors(venData)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        fetch(`/api/admin/offerable-services/${id}`)
            .then((r) => r.json())
            .then((serviceData: Record<string, unknown>) => {
                if (serviceData?.error) return
                const svc = serviceData as Record<string, unknown>
                const occasion_ids = Array.isArray(serviceData.occasion_ids)
                    ? (serviceData.occasion_ids as string[])
                    : []
                const vendor_ids = Array.isArray(serviceData.vendor_ids)
                    ? (serviceData.vendor_ids as string[])
                    : []
                setForm({
                    occasion_ids,
                    vendor_ids,
                    category_id: (svc.category_id as string) ?? '',
                    name: (svc.name as string) ?? '',
                    description: (svc.description as string) ?? '',
                    display_order: Number(svc.display_order) ?? 0,
                    image_url: (svc.image_url as string) ?? '',
                    price_basic: svc.price_basic != null ? String(svc.price_basic) : '',
                    price_classic_value:
                        svc.price_classic_value != null ? String(svc.price_classic_value) : '',
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
                    sub_variety_basic: (svc.sub_variety_basic as string) ?? '',
                    sub_variety_classic_value: (svc.sub_variety_classic_value as string) ?? '',
                    sub_variety_signature: (svc.sub_variety_signature as string) ?? '',
                    sub_variety_prestige: (svc.sub_variety_prestige as string) ?? '',
                    sub_variety_royal: (svc.sub_variety_royal as string) ?? '',
                    sub_variety_imperial: (svc.sub_variety_imperial as string) ?? '',
                    is_active: svc.is_active !== false,
                    is_special_catalog: svc.is_special_catalog === true,
                })
            })
            .catch(() => {})
    }, [id])

    useEffect(() => {
        if (form.is_special_catalog) {
            if (!occasions.length) return
            const oid = occasions[0].id
            fetch(`/api/public/categories?occasion_id=${encodeURIComponent(oid)}`)
                .then((r) => r.json())
                .then((data) => {
                    if (Array.isArray(data)) setCategories(data)
                })
                .catch(() => setCategories([]))
            return
        }
        if (!form.occasion_ids.length) {
            setCategories([])
            return
        }
        Promise.all(
            form.occasion_ids.map((oid) =>
                fetch(`/api/public/categories?occasion_id=${encodeURIComponent(oid)}`).then((r) =>
                    r.json()
                )
            )
        )
            .then((lists) => {
                const map = new Map<string, Category>()
                for (const arr of lists) {
                    if (Array.isArray(arr))
                        for (const c of arr) map.set(c.id, { id: c.id, name: c.name })
                }
                setCategories([...map.values()].sort((a, b) => a.name.localeCompare(b.name)))
            })
            .catch(() => setCategories([]))
    }, [form.occasion_ids, form.is_special_catalog, occasions])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.is_special_catalog && form.occasion_ids.length === 0) {
            toast.error('Select at least one occasion')
            return
        }
        if (!form.category_id) {
            toast.error('Select a category')
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
        const body: Record<string, unknown> = {
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
            sub_variety_basic: form.sub_variety_basic || null,
            sub_variety_classic_value: form.sub_variety_classic_value || null,
            sub_variety_signature: form.sub_variety_signature || null,
            sub_variety_prestige: form.sub_variety_prestige || null,
            sub_variety_royal: form.sub_variety_royal || null,
            sub_variety_imperial: form.sub_variety_imperial || null,
            ...tierValues,
        }
        if (!form.is_special_catalog) {
            body.replace_occasion_links = true
            body.occasion_ids = form.occasion_ids
        } else {
            body.replace_occasion_links = true
            body.occasion_ids = []
        }
        body.replace_vendor_links = true
        body.vendor_ids = form.vendor_ids
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
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Occasions</label>
                                <div className="flex items-center gap-3 text-xs">
                                    <label className="flex cursor-pointer items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={form.is_special_catalog || hasAllSelected(form.occasion_ids, occasions.map((o) => o.id))}
                                            onChange={(e) => {
                                                if (form.is_special_catalog) return
                                                setForm((p) => ({
                                                    ...p,
                                                    occasion_ids: e.target.checked ? occasions.map((o) => o.id) : [],
                                                    category_id: '',
                                                }))
                                            }}
                                            disabled={form.is_special_catalog || occasions.length === 0}
                                        />
                                        <span>Select all</span>
                                    </label>
                                    {!form.is_special_catalog && (
                                        <button
                                            type="button"
                                            className="text-primary underline"
                                            onClick={() => setForm((p) => ({ ...p, occasion_ids: [], category_id: '' }))}
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="mt-1 max-h-36 overflow-y-auto rounded-md border px-3 py-2">
                                {occasions.map((o) => (
                                    <label key={o.id} className="flex cursor-pointer items-center gap-2 py-1">
                                        <input
                                            type="checkbox"
                                            checked={form.is_special_catalog || form.occasion_ids.includes(o.id)}
                                            onChange={() =>
                                                setForm((p) => ({
                                                    ...p,
                                                    occasion_ids: toggleId(p.occasion_ids, o.id),
                                                    category_id: '',
                                                }))
                                            }
                                            disabled={form.is_special_catalog}
                                        />
                                        <span>{o.name}</span>
                                    </label>
                                ))}
                            </div>
                            {form.is_special_catalog && (
                                <p className="text-muted-foreground mt-1 text-xs">
                                    Special catalog applies to all occasions.
                                </p>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Vendors (optional)</label>
                                <div className="flex items-center gap-3 text-xs">
                                    <label className="flex cursor-pointer items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={hasAllSelected(form.vendor_ids, vendors.map((v) => v.id))}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    vendor_ids: e.target.checked ? vendors.map((v) => v.id) : [],
                                                }))
                                            }
                                            disabled={vendors.length === 0}
                                        />
                                        <span>Select all</span>
                                    </label>
                                    <button
                                        type="button"
                                        className="text-primary underline"
                                        onClick={() => setForm((p) => ({ ...p, vendor_ids: [] }))}
                                    >
                                        Clear all
                                    </button>
                                </div>
                            </div>
                            <div className="mt-1 max-h-36 overflow-y-auto rounded-md border px-3 py-2">
                                {vendors.map((v) => (
                                    <label key={v.id} className="flex cursor-pointer items-center gap-2 py-1">
                                        <input
                                            type="checkbox"
                                            checked={form.vendor_ids.includes(v.id)}
                                            onChange={() =>
                                                setForm((p) => ({
                                                    ...p,
                                                    vendor_ids: toggleId(p.vendor_ids, v.id),
                                                }))
                                            }
                                        />
                                        <span>{v.business_name || v.id}</span>
                                    </label>
                                ))}
                            </div>
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
                                disabled={!form.is_special_catalog && !form.occasion_ids.length}
                            >
                                <option value="">
                                    {form.is_special_catalog || form.occasion_ids.length
                                        ? 'Select category'
                                        : 'Select occasion(s) first'}
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
                                Pricing (tiers) — unit label and sub variety appear alongside the price.
                            </label>
                            <div className="space-y-2 rounded-md border p-3 overflow-x-auto">
                                <div className="flex min-w-[640px] items-center gap-2 pb-1 text-xs font-medium text-muted-foreground">
                                    <span className="w-28 shrink-0">Tier</span>
                                    <span className="w-28 shrink-0">Price ₹</span>
                                    <span className="w-36 shrink-0">Unit / qty label</span>
                                    <span className="min-w-[140px] flex-1">Sub variety</span>
                                </div>
                                {TIER_LABELS.map(({ key, label, qtyKey, subKey }) => (
                                    <div
                                        key={key}
                                        className="flex min-w-[640px] flex-wrap items-center gap-2 sm:flex-nowrap"
                                    >
                                        <label className="w-28 shrink-0 text-sm">
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
                                            className="w-28 shrink-0"
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
                                            className="w-36 shrink-0"
                                        />
                                        <Input
                                            type="text"
                                            placeholder="Sub variety"
                                            value={form[subKey as keyof typeof form] as string}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    [subKey]: e.target.value,
                                                }))
                                            }
                                            className="min-w-[120px] flex-1"
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
