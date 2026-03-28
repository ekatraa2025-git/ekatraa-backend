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

type Row = {
    id: string
    name: string
    category_id: string
    city?: string | null
    image_url?: string
    is_active?: boolean
    price_basic?: number | null
    price_unit?: string | null
}

export default function SpecialCatalogServicesPage() {
    const [items, setItems] = useState<Row[]>([])
    const [filtered, setFiltered] = useState<Row[]>([])
    const [loading, setLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

    useEffect(() => {
        fetch('/api/admin/offerable-services?special_catalog=1')
            .then((r) => r.json())
            .then((data) => {
                if (!data.error) {
                    const list = Array.isArray(data) ? data : []
                    setItems(list)
                    setFiltered(list)
                }
                setLoading(false)
            })
    }, [])

    const handleSearch = (val: string) => {
        const v = val.toLowerCase()
        setFiltered(
            items.filter(
                (e) =>
                    e.name?.toLowerCase().includes(v) ||
                    (e.city || '').toLowerCase().includes(v) ||
                    e.category_id?.toLowerCase().includes(v)
            )
        )
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
        await Promise.all(
            ids.map((id) =>
                fetch(`/api/admin/offerable-services/${id}`, { method: 'DELETE' }).then((r) => r.json())
            )
        )
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
        {
            header: 'City',
            key: 'city',
            render: (v: string | null | undefined) => v || '—',
        },
        {
            header: 'Basic ₹',
            key: 'price_basic',
            render: (v: number | null | undefined) =>
                v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—',
        },
        {
            header: 'Unit',
            key: 'price_unit',
            render: (v: string | null | undefined) => v || '—',
        },
        {
            header: 'Active',
            key: 'is_active',
            render: (v: boolean) => (
                <Badge variant={v ? 'secondary' : 'outline'}>{v ? 'Yes' : 'No'}</Badge>
            ),
        },
    ]

    if (loading) {
        return (
            <DefaultLayout>
                <div className="flex h-60 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DefaultLayout>
        )
    }

    return (
        <DefaultLayout>
            <DataTableView
                title="Special catalog (all occasions)"
                description="Global add-ons shown on Special add-ons in the app. Pricing and labels are managed here."
                columns={columns}
                data={filtered}
                onSearch={handleSearch}
                addNewLink="/admin/offerable-services/new?special_catalog=1"
                addNewLabel="Add special service"
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
                title="Delete special service"
                description={`Are you sure you want to delete "${deleteTarget?.name}"?`}
                onConfirm={confirmDelete}
            />
        </DefaultLayout>
    )
}
