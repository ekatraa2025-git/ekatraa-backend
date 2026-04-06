'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { ConfirmDialog } from '@/components/Common/ConfirmDialog'
import { toast } from 'sonner'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { Edit, Trash2, Loader2, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AdminImage } from '@/components/Common/AdminImage'

export default function OfferableServicesPage() {
    const [items, setItems] = useState<
        {
            id: string
            name: string
            category_id: string
            image_url?: string
            is_active?: boolean
            price_min?: number
            price_max?: number
            price_basic?: number | null
            price_classic_value?: number | null
            price_signature?: number | null
            price_prestige?: number | null
            price_royal?: number | null
            price_imperial?: number | null
        }[]
    >([])
    const [filtered, setFiltered] = useState<typeof items>([])
    const [loading, setLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<{id: string; name: string} | null>(null)
    const [occasions, setOccasions] = useState<{ id: string; name: string }[]>([])
    const [vendors, setVendors] = useState<{ id: string; business_name: string }[]>([])
    const [occasionFilterIds, setOccasionFilterIds] = useState<string[]>([])
    const [vendorFilterIds, setVendorFilterIds] = useState<string[]>([])

    useEffect(() => {
        fetch('/api/admin/occasions')
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setOccasions(data)
            })
            .catch(() => {})
        fetch('/api/admin/vendors?status=active')
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setVendors(data)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        setLoading(true)
        const params = new URLSearchParams()
        if (occasionFilterIds.length > 0) {
            params.set('occasion_ids', occasionFilterIds.join(','))
        }
        if (vendorFilterIds.length > 0) {
            params.set('vendor_ids', vendorFilterIds.join(','))
        }
        const q = params.toString() ? `?${params.toString()}` : ''
        fetch(`/api/admin/offerable-services${q}`)
            .then((r) => r.json())
            .then((data) => {
                if (!data.error) {
                    const list = Array.isArray(data) ? data : []
                    setItems(list)
                    setFiltered(list)
                }
                setLoading(false)
            })
    }, [occasionFilterIds, vendorFilterIds])

    const toggleOccasionFilter = (id: string) => {
        setOccasionFilterIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        )
    }
    const toggleVendorFilter = (id: string) => {
        setVendorFilterIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        )
    }

    const handleSearch = (val: string) => {
        const v = val.toLowerCase()
        const f = items.filter(
            (e) =>
                e.name?.toLowerCase().includes(v) ||
                e.category_id?.toLowerCase().includes(v)
        )
        setFiltered(f)
    }

    const handleDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name })
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        const res = await fetch(`/api/admin/offerable-services/${deleteTarget.id}`, { method: 'DELETE' })
        const result = await res.json()
        if (result.error) toast.error(result.error)
        else {
            setItems((prev) => prev.filter((e) => e.id !== deleteTarget.id))
            setFiltered((prev) => prev.filter((e) => e.id !== deleteTarget.id))
            toast.success('Deleted successfully')
        }
        setDeleteTarget(null)
    }

    const handleBulkDelete = async (ids: string[]) => {
        await Promise.all(ids.map((id) => fetch(`/api/admin/offerable-services/${id}`, { method: 'DELETE' }).then((r) => r.json())))
        setItems((prev) => prev.filter((e) => !ids.includes(e.id)))
        setFiltered((prev) => prev.filter((e) => !ids.includes(e.id)))
    }

    const columns = [
        {
            header: 'Image',
            key: 'image_url',
            render: (v: string) => (
                <AdminImage
                    url={v}
                    alt="Service"
                    className="h-10 w-10 rounded-lg object-cover"
                    placeholderClassName="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-xs"
                />
            ),
        },
        { header: 'Name', key: 'name' },
        { header: 'Category', key: 'category_id' },
        {
            header: 'Basic',
            key: 'price_basic',
            render: (v: number | null | undefined) =>
                v != null ? `₹${Number(v).toLocaleString()}` : '—',
        },
        {
            header: 'Classic',
            key: 'price_classic_value',
            render: (v: number | null | undefined) =>
                v != null ? `₹${Number(v).toLocaleString()}` : '—',
        },
        {
            header: 'Signature',
            key: 'price_signature',
            render: (v: number | null | undefined) =>
                v != null ? `₹${Number(v).toLocaleString()}` : '—',
        },
        {
            header: 'Prestige',
            key: 'price_prestige',
            render: (v: number | null | undefined) =>
                v != null ? `₹${Number(v).toLocaleString()}` : '—',
        },
        {
            header: 'Royal',
            key: 'price_royal',
            render: (v: number | null | undefined) =>
                v != null ? `₹${Number(v).toLocaleString()}` : '—',
        },
        {
            header: 'Imperial',
            key: 'price_imperial',
            render: (v: number | null | undefined) =>
                v != null ? `₹${Number(v).toLocaleString()}` : '—',
        },
        {
            header: 'Active',
            key: 'is_active',
            render: (v: boolean) => (
                <Badge variant={v ? 'secondary' : 'outline'}>
                    {v ? 'Yes' : 'No'}
                </Badge>
            ),
        },
    ]

    if (loading) {
        return (
            <DefaultLayout>
                <div className="flex h-60 items-center justify-center">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
            </DefaultLayout>
        )
    }

    return (
        <DefaultLayout>
            <div className="mb-4 flex flex-wrap gap-6">
                <div className="min-w-[220px] max-w-md">
                    <label className="text-sm font-medium">Occasions (multi)</label>
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-md border px-3 py-2 text-sm">
                        {occasions.map((o) => (
                            <label key={o.id} className="flex cursor-pointer items-center gap-2 py-1">
                                <input
                                    type="checkbox"
                                    checked={occasionFilterIds.includes(o.id)}
                                    onChange={() => toggleOccasionFilter(o.id)}
                                />
                                <span>{o.name}</span>
                            </label>
                        ))}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">Leave empty for all. Services linked to any selected occasion.</p>
                </div>
                <div className="min-w-[220px] max-w-md">
                    <label className="text-sm font-medium">Vendors (multi)</label>
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-md border px-3 py-2 text-sm">
                        {vendors.map((v) => (
                            <label key={v.id} className="flex cursor-pointer items-center gap-2 py-1">
                                <input
                                    type="checkbox"
                                    checked={vendorFilterIds.includes(v.id)}
                                    onChange={() => toggleVendorFilter(v.id)}
                                />
                                <span>{v.business_name || v.id}</span>
                            </label>
                        ))}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                        Optional. Empty vendor rows in catalog = all vendors; otherwise match assigned vendors.
                    </p>
                </div>
            </div>
            <DataTableView
                title="Services"
                description="Offerable services in the new flow (category-based, no subcategory)."
                columns={columns}
                data={filtered}
                onSearch={handleSearch}
                addNewLink="/admin/offerable-services/new"
                addNewLabel="Add Service"
                selectable
                onBulkDelete={handleBulkDelete}
                editLinkBase="/admin/offerable-services"
                editLinkSuffix=""
                actions={(item) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/offerable-services/${item.id}`} className="flex items-center">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10"
                                onClick={() => handleDelete(item.id, item.name)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Delete Service"
                description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
            />
        </DefaultLayout>
    )
}
