'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { createClient } from '@/utils/supabase/client'
import { FileText, Loader2, MoreHorizontal, Eye, Download, Printer } from 'lucide-react'
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

    const handleSearch = (val: string) => {
        const filtered = quotations.filter(q =>
            q.vendors?.business_name?.toLowerCase().includes(val.toLowerCase()) ||
            q.id?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredQuotations(filtered)
    }

    const columns = [
        { header: 'Quotation #', key: 'id', render: (val: string) => <span className="font-mono text-xs uppercase">{val.slice(0, 8)}</span> },
        { header: 'Vendor', key: 'vendors', render: (val: any) => val?.business_name || 'N/A' },
        { header: 'Booking Ref', key: 'bookings', render: (val: any) => val?.id?.slice(0, 8) || 'N/A' },
        { header: 'Amount', key: 'total_amount', render: (val: number) => <span className="font-semibold">₹{val || 0}</span> },
        {
            header: 'Status',
            key: 'status',
            render: (val: string) => (
                <Badge variant={val === 'accepted' ? 'secondary' as const : val === 'draft' ? 'outline' as const : 'outline' as const}>
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
                description="Review and manage vendor quotes for customer bookings."
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
                            <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Quotation
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Printer className="mr-2 h-4 w-4" />
                                Print Receipt
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-emerald-600">
                                <FileText className="mr-2 h-4 w-4" />
                                Accept Quote
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
        </DefaultLayout>
    )
}

