'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { Eye, Loader2, MapPin, ChevronDown } from 'lucide-react'
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
import { toast } from 'sonner'

function AllocationIndicator({ count, vendors }: { count: number; vendors: { vendor_id: string; vendor_name: string | null; city?: string | null }[] }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="flex flex-col items-start text-left hover:underline cursor-pointer">
                    <span className="text-sm font-medium">{count} allocation{count !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {vendors.slice(0, 2).map((v) => v.vendor_name || 'Vendor').join(', ')}
                        {vendors.length > 2 && ` +${vendors.length - 2}`}
                        <ChevronDown className="h-3 w-3" />
                    </span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Allocated to vendors
                </DropdownMenuLabel>
                {vendors.map((v) => (
                    <DropdownMenuItem key={v.vendor_id} disabled className="flex flex-col items-start cursor-default">
                        <span className="font-medium">{v.vendor_name || 'Unknown'}</span>
                        {v.city && <span className="text-xs text-muted-foreground">{v.city}</span>}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default function OrdersPage() {
    const [items, setItems] = useState<{ id: string; user_id: string; status: string; vendor_id?: string | null; vendor_name?: string | null; total_amount?: number; advance_amount?: number; advance_paid_at?: string; razorpay_payment_id?: string; created_at?: string; contact_name?: string; allocation_count?: number; allocation_vendors?: { vendor_id: string; vendor_name: string | null; city?: string | null }[] }[]>([])
    const [loading, setLoading] = useState(true)
    const [allocationFilter, setAllocationFilter] = useState<'all' | 'allocated' | 'unallocated'>('all')
    const [searchValue, setSearchValue] = useState('')

    useEffect(() => {
        fetch('/api/admin/orders')
            .then((r) => r.json())
            .then((data) => {
                if (!data.error) {
                    const list = Array.isArray(data) ? data : []
                    setItems(list)
                }
                setLoading(false)
            })
    }, [])

    const handleSearch = (val: string) => {
        setSearchValue(val)
    }

    const refreshOrders = async () => {
        const r = await fetch('/api/admin/orders')
        const data = await r.json()
        if (!data?.error) {
            const list = Array.isArray(data) ? data : []
            setItems(list)
        }
    }

    const filtered = items.filter((e) => {
        const isAllocated = (!!e.vendor_id && e.vendor_id !== '') || (e.allocation_count ?? 0) > 0
        if (allocationFilter === 'allocated' && !isAllocated) return false
        if (allocationFilter === 'unallocated' && isAllocated) return false
        if (!searchValue.trim()) return true
        const v = searchValue.toLowerCase()
        return (
            e.id?.toLowerCase().includes(v) ||
            e.status?.toLowerCase().includes(v) ||
            e.contact_name?.toLowerCase().includes(v)
        )
    })

    const handleUnallocate = async (id: string) => {
        const res = await fetch(`/api/admin/orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vendor_id: null }),
        })
        const data = await res.json()
        if (data?.error) {
            toast.error(data.error)
            return
        }
        toast.success('Allocation reversed successfully')
        await refreshOrders()
    }

    const handleDeleteOrder = async (id: string) => {
        if (!window.confirm('Delete this order? This action cannot be undone.')) return
        const res = await fetch(`/api/admin/orders/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (data?.error) {
            toast.error(data.error)
            return
        }
        toast.success('Order deleted successfully')
        await refreshOrders()
    }

    const columns = [
        { header: 'Order ID', key: 'id', render: (v: string) => <span className="font-mono text-xs">{v?.slice(0, 8)}…</span> },
        { header: 'Contact', key: 'contact_name' },
        { header: 'Total', key: 'total_amount', render: (v: number) => (v != null ? `₹${Number(v).toLocaleString()}` : '—') },
        { header: 'Advance', key: 'advance_amount', render: (v: number) => (v != null && v > 0 ? `₹${Number(v).toLocaleString()}` : '—') },
        {
            header: 'Status',
            key: 'status',
            render: (v: string) => (
                <Badge variant="outline" className="capitalize">
                    {v || '—'}
                </Badge>
            ),
        },
        {
            header: 'Allocation',
            key: 'allocation_count',
            render: (_v: unknown, item: { allocation_count?: number; allocation_vendors?: { vendor_id: string; vendor_name: string | null; city?: string | null }[] }) => {
                const count = item.allocation_count ?? 0
                const vendors = item.allocation_vendors ?? []
                if (count === 0) return <span className="text-muted-foreground text-sm">—</span>
                return (
                    <AllocationIndicator count={count} vendors={vendors} />
                )
            },
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
            <div className="mb-4 flex gap-2">
                <Button variant={allocationFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setAllocationFilter('all')}>
                    All
                </Button>
                <Button variant={allocationFilter === 'allocated' ? 'default' : 'outline'} size="sm" onClick={() => setAllocationFilter('allocated')}>
                    Allocated
                </Button>
                <Button variant={allocationFilter === 'unallocated' ? 'default' : 'outline'} size="sm" onClick={() => setAllocationFilter('unallocated')}>
                    Unallocated
                </Button>
            </div>
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
                            <DropdownMenuItem
                                onClick={() => handleUnallocate(item.id)}
                                disabled={!item.vendor_id && (item.allocation_count ?? 0) === 0}
                            >
                                Reverse Allocation
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteOrder(item.id)}>
                                Delete Order
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
        </DefaultLayout>
    )
}
