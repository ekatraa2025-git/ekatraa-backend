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

export default function OccasionsPage() {
    const [items, setItems] = useState<{ id: string; name: string; image_url?: string; display_order?: number; is_active?: boolean }[]>([])
    const [filtered, setFiltered] = useState<typeof items>([])
    const [loading, setLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<{id: string; name: string} | null>(null)

    useEffect(() => {
        fetch('/api/admin/occasions')
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
        await Promise.all(ids.map((id) => fetch(`/api/admin/occasions/${id}`, { method: 'DELETE' }).then((r) => r.json())))
        setItems((prev) => prev.filter((e) => !ids.includes(e.id)))
        setFiltered((prev) => prev.filter((e) => !ids.includes(e.id)))
    }

    const handleDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name })
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        const res = await fetch(`/api/admin/occasions/${deleteTarget.id}`, { method: 'DELETE' })
        const result = await res.json()
        if (result.error) toast.error(result.error)
        else {
            setItems((prev) => prev.filter((e) => e.id !== deleteTarget.id))
            setFiltered((prev) => prev.filter((e) => e.id !== deleteTarget.id))
            toast.success('Deleted successfully')
        }
        setDeleteTarget(null)
    }

    const columns = [
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'name' },
        {
            header: 'Image',
            key: 'image_url',
            render: (v: string) =>
                v ? (
                    <AdminImage
                        url={v}
                        alt="Occasion"
                        className="h-10 w-14 rounded object-cover"
                        placeholderClassName="h-10 w-14 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-500"
                    />
                ) : (
                    '—'
                ),
        },
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
                title="Occasions"
                description="Canonical occasions for the app flow (e.g. wedding, janeyu_thread)."
                columns={columns}
                data={filtered}
                onSearch={handleSearch}
                addNewLink="/admin/occasions/new"
                addNewLabel="Add Occasion"
                selectable
                onBulkDelete={handleBulkDelete}
                editLinkBase="/admin/occasions"
                editLinkSuffix="/edit"
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
                                <Link href={`/admin/occasions/${item.id}/edit`} className="flex items-center">
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
                title="Delete Occasion"
                description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
            />
        </DefaultLayout>
    )
}
