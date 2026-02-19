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

export default function EventTypesPage() {
    const [eventTypes, setEventTypes] = useState<any[]>([])
    const [filtered, setFiltered] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/admin/event-types')
            .then(r => r.json())
            .then(data => {
                if (!data.error) {
                    setEventTypes(Array.isArray(data) ? data : [])
                    setFiltered(Array.isArray(data) ? data : [])
                }
                setLoading(false)
            })
    }, [])

    const handleSearch = (val: string) => {
        const f = eventTypes.filter(e =>
            e.name?.toLowerCase().includes(val.toLowerCase()) ||
            e.id?.toLowerCase().includes(val.toLowerCase())
        )
        setFiltered(f)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this get-together type? It may break app if in use.')) return
        const res = await fetch(`/api/admin/event-types/${id}`, { method: 'DELETE' })
        const result = await res.json()
        if (result.error) alert(result.error)
        else {
            setEventTypes(prev => prev.filter(e => e.id !== id))
            setFiltered(prev => prev.filter(e => e.id !== id))
        }
    }

    const columns = [
        {
            header: 'Icon / Image',
            key: 'image_url',
            render: (v: string, row: any) => v ? (
                <img src={v} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
                <span className="text-2xl">{row.icon || '🎉'}</span>
            )
        },
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'name' },
        { header: 'Order', key: 'display_order' },
        {
            header: 'Color',
            key: 'color',
            render: (v: string) => v ? (
                <span className="inline-flex items-center gap-1">
                    <span className="h-5 w-5 rounded border" style={{ backgroundColor: v }} />
                    {v}
                </span>
            ) : '—'
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
                title="Get Together Types"
                description="Manage event types (Wedding, Birthday, etc.) shown in the app with icon, image and color."
                columns={columns}
                data={filtered}
                onSearch={handleSearch}
                addNewLink="/admin/event-types/new"
                addNewLabel="Add Get Together Type"
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
                                <Link href={`/admin/event-types/${item.id}/edit`} className="flex items-center">
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
