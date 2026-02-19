'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
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

export default function BannersPage() {
    const [banners, setBanners] = useState<any[]>([])
    const [filteredBanners, setFilteredBanners] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchBanners()
    }, [])

    const fetchBanners = async () => {
        const res = await fetch('/api/admin/banners')
        const data = await res.json()
        if (data && !data.error) {
            setBanners(Array.isArray(data) ? data : [])
            setFilteredBanners(Array.isArray(data) ? data : [])
        }
        setLoading(false)
    }

    const handleSearch = (val: string) => {
        const filtered = banners.filter(b =>
            b.title?.toLowerCase().includes(val.toLowerCase()) ||
            b.subtitle?.toLowerCase().includes(val.toLowerCase()) ||
            b.banner_type?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredBanners(filtered)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this banner?')) return
        const res = await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' })
        const result = await res.json()
        if (result.error) alert(result.error)
        else fetchBanners()
    }

    const columns = [
        {
            header: 'Preview',
            key: 'image_url',
            render: (val: string) => val ? (
                <img src={val} alt="" className="h-10 w-16 rounded object-cover" />
            ) : (
                <div className="h-10 w-16 rounded bg-muted flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
            )
        },
        { header: 'Title', key: 'title' },
        { header: 'Subtitle', key: 'subtitle', render: (v: string) => <span className="text-muted-foreground line-clamp-1 max-w-[200px]">{v || '—'}</span> },
        { header: 'Type', key: 'banner_type', render: (v: string) => <Badge variant="outline" className="capitalize">{v || 'promotional'}</Badge> },
        { header: 'Order', key: 'display_order' },
        { header: 'Active', key: 'is_active', render: (v: boolean) => <Badge variant={v ? 'secondary' : 'outline'}>{v ? 'Yes' : 'No'}</Badge> },
    ]

    if (loading) {
        return (
            <DefaultLayout>
                <div className="flex h-60 items-center justify-center">
                    <Loader2 className="animate-spin text-primary w-8 h-8" />
                </div>
            </DefaultLayout>
        )
    }

    return (
        <DefaultLayout>
            <DataTableView
                title="Banners"
                description="Manage promotional banners and success stories shown in the app."
                columns={columns}
                data={filteredBanners}
                onSearch={handleSearch}
                addNewLink="/admin/banners/new"
                addNewLabel="Add Banner"
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
                                <Link href={`/admin/banners/${item.id}/edit`} className="flex items-center">
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
