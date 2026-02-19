'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { MoreHorizontal, Edit, Trash2, Package, Tag } from 'lucide-react'
import { DataTableView } from '@/components/admin-panel/data-table-view'
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

export default function StocksPage() {
    const [stocks, setStocks] = useState<any[]>([])
    const [filteredStocks, setFilteredStocks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStocks()
    }, [])

    const fetchStocks = async () => {
        const res = await fetch('/api/admin/stocks')
        const data = await res.json()

        if (data && !data.error) {
            setStocks(data)
            setFilteredStocks(data)
        } else if (data?.error) {
            console.error('API Error:', data.error)
        }
        setLoading(false)
    }

    const handleSearch = (val: string) => {
        const filtered = stocks.filter(s =>
            s.name?.toLowerCase().includes(val.toLowerCase()) ||
            s.subcategory?.name?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredStocks(filtered)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this service item?')) return

        const res = await fetch(`/api/admin/stocks/${id}`, { method: 'DELETE' })
        const result = await res.json()

        if (result.error) {
            alert(result.error)
        } else {
            fetchStocks()
        }
    }

    const columns = [
        {
            header: 'Service Item',
            key: 'name',
            render: (val: string) => (
                <div className="flex items-center gap-2 font-medium">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Package className="h-4 w-4" />
                    </div>
                    {val}
                </div>
            )
        },
        {
            header: 'Subcategory',
            key: 'subcategory',
            render: (val: any) => (
                <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span>{val?.name || 'N/A'}</span>
                </div>
            )
        },
        {
            header: 'Classic Value',
            key: 'price_classic_value',
            render: (val: number) => <span className="font-semibold">₹{val?.toLocaleString() ?? '0'}</span>
        },
        {
            header: 'Signature',
            key: 'price_signature',
            render: (val: number) => <span className="font-semibold text-blue-500">₹{val?.toLocaleString() ?? '0'}</span>
        },
        {
            header: 'Prestige',
            key: 'price_prestige',
            render: (val: number) => <span className="font-semibold text-amber-500">₹{val?.toLocaleString() ?? '0'}</span>
        },
        {
            header: 'Royal',
            key: 'price_royal',
            render: (val: number) => <span className="font-semibold text-purple-500">₹{val?.toLocaleString() ?? '0'}</span>
        },
        {
            header: 'Imperial',
            key: 'price_imperial',
            render: (val: number) => <span className="font-semibold text-rose-500">₹{val?.toLocaleString() ?? '0'}</span>
        },
    ]

    return (
        <DefaultLayout>
            <DataTableView
                title="Service Items"
                description="Manage service items with tiered pricing (Classic Value, Signature, Prestige, Royal, Imperial)."
                columns={columns}
                data={filteredStocks}
                onSearch={handleSearch}
                addNewLink="/admin/stocks/new"
                addNewLabel="Add Service Item"
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
                                <Link href={`/admin/stocks/${item.id}`} className="flex items-center">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Item
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onClick={() => handleDelete(item.id)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Item
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
        </DefaultLayout>
    )
}
