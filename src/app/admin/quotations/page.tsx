'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { FileText, Loader2, MoreHorizontal, Eye, Trash2 } from 'lucide-react'
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
import { toast } from 'sonner'

export default function QuotationsPage() {
    const [quotations, setQuotations] = useState<any[]>([])
    const [filteredQuotations, setFilteredQuotations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchQuotations = async () => {
            const res = await fetch('/api/admin/quotations')
            const data = await res.json()

            if (data && !data.error) {
                setQuotations(data)
                setFilteredQuotations(data)
            } else if (data.error) {
                console.error('API Error:', data.error)
            }
            setLoading(false)
        }
        fetchQuotations()
    }, [])

    const refreshQuotations = async () => {
        const res = await fetch('/api/admin/quotations')
        const data = await res.json()
        if (data && !data.error) {
            setQuotations(data)
            setFilteredQuotations(data)
        }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this quotation? This action cannot be undone.')) return
        const res = await fetch(`/api/admin/quotations/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (data?.error) {
            toast.error(data.error)
            return
        }
        toast.success('Quotation deleted successfully')
        await refreshQuotations()
    }

    const handleSearch = (val: string) => {
        const filtered = quotations.filter(q =>
            q.vendor?.business_name?.toLowerCase().includes(val.toLowerCase()) ||
            q.order?.contact_name?.toLowerCase().includes(val.toLowerCase()) ||
            q.customer_name?.toLowerCase().includes(val.toLowerCase()) ||
            q.service_type?.toLowerCase().includes(val.toLowerCase()) ||
            q.id?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredQuotations(filtered)
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'N/A'
        try {
            return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        } catch {
            return 'N/A'
        }
    }

    const columns = [
        { header: 'Quotation #', key: 'id', render: (val: string) => <span className="font-mono text-xs uppercase">{val?.slice(0, 8) || 'N/A'}</span> },
        { header: 'Service', key: 'service_type', render: (val: string, row: any) => val || row?.order?.event_name?.slice(0, 30) || 'N/A' },
        { header: 'Vendor', key: 'vendor', render: (val: any) => val?.business_name || 'N/A' },
        { header: 'Customer', key: 'customer_name', render: (val: string, row: any) => val || row?.order?.contact_name || 'N/A' },
        { header: 'Quotation Date', key: 'created_at', render: (_val: string, row: any) => formatDate(row?.quotation_submitted_at || row?.quotation_date || row?.created_at) },
        { header: 'Valid Until', key: 'valid_until', render: (val: string) => formatDate(val) },
        { header: 'Amount', key: 'amount', render: (val: number, row: any) => <span className="font-semibold text-primary">₹{val || row?.total_amount || 0}</span> },
        {
            header: 'Status',
            key: 'status',
            render: (val: string) => (
                <Badge variant={val === 'accepted' ? 'secondary' as const : val === 'rejected' ? 'destructive' as const : 'outline' as const}>
                    {val || 'Pending'}
                </Badge>
            )
        },
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
                title="Quotations"
                description="Review and manage vendor quotes for customer orders."
                columns={columns}
                data={filteredQuotations}
                onSearch={handleSearch}
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
                                <Link href={`/admin/quotations/${item.id}`} className="flex items-center">
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => handleDelete(item.id)}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Quotation
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
        </DefaultLayout>
    )
}

