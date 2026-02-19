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

export default function AppServiceCatalogPage() {
    const [items, setItems] = useState<any[]>([])
    const [filtered, setFiltered] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

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

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this service from the catalog?')) return
        const res = await fetch(`/api/admin/app-service-catalog/${id}`, { method: 'DELETE' })
        const result = await res.json()
        if (result.error) alert(result.error)
        else {
            setItems(prev => prev.filter(i => i.id !== id))
            setFiltered(prev => prev.filter(i => i.id !== id))
        }
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
                                onClick={() => handleDelete(item.id)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
        </DefaultLayout>
    )
}
