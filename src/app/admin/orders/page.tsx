'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { Eye, Loader2 } from 'lucide-react'
import Link from 'next/link'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function OrdersPage() {
    const [items, setItems] = useState<{ id: string; user_id: string; status: string; total_amount?: number; created_at?: string; contact_name?: string }[]>([])
    const [filtered, setFiltered] = useState<typeof items>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/admin/orders')
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
        const f = items.filter(
            (e) =>
                e.id?.toLowerCase().includes(v) ||
                e.status?.toLowerCase().includes(v) ||
                e.contact_name?.toLowerCase().includes(v)
        )
        setFiltered(f)
    }

    const columns = [
        { header: 'Order ID', key: 'id', render: (v: string) => <span className="font-mono text-xs">{v?.slice(0, 8)}…</span> },
        { header: 'Contact', key: 'contact_name' },
        { header: 'Total', key: 'total_amount', render: (v: number) => (v != null ? `₹${Number(v).toLocaleString()}` : '—') },
        {
            header: 'Status',
            key: 'status',
            render: (v: string) => (
                <Badge variant="outline" className="capitalize">
                    {v || '—'}
                </Badge>
            ),
        },
        { header: 'Created', key: 'created_at', render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—') },
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
                title="Orders"
                description="Orders from the new cart/checkout flow."
                columns={columns}
                data={filtered}
                onSearch={handleSearch}
                actions={(item) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <Eye className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/orders/${item.id}`} className="flex items-center">
                                    <Eye className="mr-2 h-4 w-4" />
                                    View / Update status
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
        </DefaultLayout>
    )
}
