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

export default function AppServiceCatalogPage() {
    const [items, setItems] = useState<any[]>([])
    const [filtered, setFiltered] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<{id: string; name: string} | null>(null)

    useEffect(() => {
        fetch('/api/admin/app-service-catalog')
            .then(r => r.json())
            .then(data => {
                if (!data.error) {
                    setItems(Array.isArray(data) ? data : [])
                    setFiltered(Array.isArray(data) ? data : [])
                }
                setLoading(false)
            })
    }, [])

    const handleSearch = (val: string) => {
        const f = items.filter(i =>
            i.name?.toLowerCase().includes(val.toLowerCase()) ||
            i.id?.toLowerCase().includes(val.toLowerCase())
        )
        setFiltered(f)
    }

    const handleDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name })
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        const res = await fetch(`/api/admin/app-service-catalog/${deleteTarget.id}`, { method: 'DELETE' })
        const result = await res.json()
        if (result.error) toast.error(result.error)
        else {
            setItems(prev => prev.filter(i => i.id !== deleteTarget.id))
            setFiltered(prev => prev.filter(i => i.id !== deleteTarget.id))
            toast.success('Deleted successfully')
        }
        setDeleteTarget(null)
    }

    const columns = [
        { header: 'Icon', key: 'icon', render: (v: string) => <span className="text-2xl">{v || '🎯'}</span> },
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'name' },
        { header: 'Order', key: 'display_order' },
        {
            header: 'Event types',
            key: 'event_types',
            render: (v: string[]) => (
                <span className="text-muted-foreground text-xs">
                    {Array.isArray(v) ? v.join(', ') : '—'}
                </span>
            )
        },
        { header: 'Active', key: 'is_active', render: (v: boolean) => <Badge variant={v ? 'secondary' : 'outline'}>{v ? 'Yes' : 'No'}</Badge> },
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
                title="Event Services Catalog"
                description="Manage which services appear for each get-together type in the app (e.g. Wedding, Birthday)."
                columns={columns}
                data={filtered}
                onSearch={handleSearch}
                addNewLink="/admin/app-service-catalog/new"
                addNewLabel="Add Service"
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
                                <Link href={`/admin/app-service-catalog/${item.id}/edit`} className="flex items-center">
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
