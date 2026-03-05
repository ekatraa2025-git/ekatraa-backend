'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
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
import { ConfirmDialog } from '@/components/Common/ConfirmDialog'
import { toast } from 'sonner'

export default function CatalogCategoriesPage() {
    const [items, setItems] = useState<{ id: string; name: string; icon_url?: string; display_order?: number; is_active?: boolean }[]>([])
    const [filtered, setFiltered] = useState<typeof items>([])
    const [loading, setLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

    useEffect(() => {
        fetch('/api/admin/catalog-categories')
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
        const f = items.filter(
            (e) =>
                e.name?.toLowerCase().includes(val.toLowerCase()) ||
                e.id?.toLowerCase().includes(val.toLowerCase())
        )
        setFiltered(f)
    }

    const handleBulkDelete = async (ids: string[]) => {
        const results = await Promise.all(ids.map((id) => fetch(`/api/admin/catalog-categories/${id}`, { method: 'DELETE' }).then((r) => r.json())))
        const errors = results.filter((r) => r.error)
        if (errors.length) toast.error(`${errors.length} item(s) failed to delete`)
        else toast.success(`${ids.length} category(ies) deleted`)
        setItems((prev) => prev.filter((e) => !ids.includes(e.id)))
        setFiltered((prev) => prev.filter((e) => !ids.includes(e.id)))
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        const res = await fetch(`/api/admin/catalog-categories/${deleteTarget.id}`, { method: 'DELETE' })
        const result = await res.json()
        if (result.error) toast.error(result.error)
        else {
            toast.success(`"${deleteTarget.name}" deleted successfully`)
            setItems((prev) => prev.filter((e) => e.id !== deleteTarget.id))
            setFiltered((prev) => prev.filter((e) => e.id !== deleteTarget.id))
        }
        setDeleteTarget(null)
    }

    const columns = [
        { header: 'ID', key: 'id' },
        {
            header: 'Icon',
            key: 'icon_url',
            render: (v: string) => (
                <AdminImage
                    url={v}
                    alt="Icon"
                    className="h-10 w-10 rounded-lg object-cover"
                    placeholderClassName="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-xs"
                />
            ),
        },
        { header: 'Name', key: 'name' },
        { header: 'Order', key: 'display_order' },
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
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
            </DefaultLayout>
        )
    }

    return (
        <DefaultLayout>
            <DataTableView
                title="Catalog Categories"
                description="Categories for the new flow (linked directly to occasions, each category can be attached to one or more occasions)."
                columns={columns}
                data={filtered}
                onSearch={handleSearch}
                addNewLink="/admin/catalog-categories/new"
                addNewLabel="Add Category"
                selectable
                onBulkDelete={handleBulkDelete}
                editLinkBase="/admin/catalog-categories"
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
                                <Link href={`/admin/catalog-categories/${item.id}`} className="flex items-center">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10"
                                onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
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
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                title="Delete Category"
                description={`This will permanently delete "${deleteTarget?.name}" and all its linked services. This action cannot be undone.`}
                onConfirm={confirmDelete}
            />
        </DefaultLayout>
    )
}
