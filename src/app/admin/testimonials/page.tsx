'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { ConfirmDialog } from '@/components/Common/ConfirmDialog'
import { toast } from 'sonner'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { Edit, Trash2, Loader2, MoreHorizontal, Image as ImageIcon } from 'lucide-react'
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

export default function TestimonialsAdminPage() {
    const [items, setItems] = useState<any[]>([])
    const [filtered, setFiltered] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

    const fetchItems = async () => {
        const res = await fetch('/api/admin/testimonials')
        const data = await res.json()
        if (data && !data.error) {
            const list = Array.isArray(data) ? data : []
            setItems(list)
            setFiltered(list)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchItems()
    }, [])

    const handleSearch = (val: string) => {
        const v = val.toLowerCase()
        setFiltered(
            items.filter(
                (e) =>
                    e.display_name?.toLowerCase().includes(v) ||
                    (e.testimonial_text || '').toLowerCase().includes(v)
            )
        )
    }

    const handleDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name })
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        const res = await fetch(`/api/admin/testimonials/${deleteTarget.id}`, { method: 'DELETE' })
        const result = await res.json()
        if (result.error) toast.error(result.error)
        else {
            fetchItems()
            toast.success('Deleted')
        }
        setDeleteTarget(null)
    }

    const columns = [
        {
            header: 'Photo',
            key: 'image_url',
            render: (val: string) =>
                val ? (
                    <AdminImage
                        url={val}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover border border-border"
                        placeholderClassName="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs"
                    />
                ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                ),
        },
        { header: 'Name', key: 'display_name' },
        {
            header: 'Quote',
            key: 'testimonial_text',
            render: (v: string) => (
                <span className="text-muted-foreground line-clamp-2 max-w-[240px]">{v || '—'}</span>
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
                    <Loader2 className="animate-spin text-primary h-8 w-8" />
                </div>
            </DefaultLayout>
        )
    }

    return (
        <DefaultLayout>
            <DataTableView
                title="Testimonials"
                description="Home screen stories: name, quote, image, YouTube, voice URL."
                columns={columns}
                data={filtered}
                onSearch={handleSearch}
                addNewLink="/admin/testimonials/new"
                addNewLabel="Add testimonial"
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
                                <Link href={`/admin/testimonials/${item.id}`} className="flex items-center">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10"
                                onClick={() => handleDelete(item.id, item.display_name)}
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
                title="Delete testimonial"
                description={`Remove "${deleteTarget?.name}"?`}
                onConfirm={confirmDelete}
            />
        </DefaultLayout>
    )
}
