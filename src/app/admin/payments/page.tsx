'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { CreditCard, DollarSign, Clock, CheckCircle, Wallet, MoreHorizontal, Receipt } from 'lucide-react'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function PaymentsPage() {
    const [vendorPayouts, setVendorPayouts] = useState<any[]>([])
    const [filteredPayouts, setFilteredPayouts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPayments()
    }, [])

    const fetchPayments = async () => {
        const res = await fetch('/api/admin/payments')
        const data = await res.json()

        if (data && !data.error) {
            setVendorPayouts(data)
            setFilteredPayouts(data)
        } else if (data.error) {
            console.error('API Error:', data.error)
        }
        setLoading(false)
    }

    const handleSearch = (val: string) => {
        const filtered = vendorPayouts.filter(v =>
            v.business_name?.toLowerCase().includes(val.toLowerCase()) ||
            v.owner_name?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredPayouts(filtered)
    }

    const columns = [
        { header: 'Vendor Name', key: 'business_name' },
        { header: 'Contact Person', key: 'owner_name' },
        {
            header: 'Pending Balance',
            key: 'balance',
            render: (val: number) => <span className="font-semibold text-amber-600">₹{val || 0}</span>
        },
        {
            header: 'Last Payout',
            key: 'last_payout',
            render: (val: string) => val ? new Date(val).toLocaleDateString() : <span className="text-muted-foreground italic text-xs">No history</span>
        },
    ]

    const handleProcessPayment = async (vendorId: string) => {
        const res = await fetch(`/api/admin/vendors/${vendorId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ last_payout: new Date().toISOString(), balance: 0 })
        })
        const result = await res.json()

        if (result.error) {
            alert(result.error)
        } else {
            alert('Payment processed successfully!')
            fetchPayments()
        }
    }

    return (
        <DefaultLayout>
            <div className="flex flex-col gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Payments Management</h2>
                    <p className="text-muted-foreground">Manage vendor payouts and track financial transactions.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">₹4,25,000</div>
                            <p className="text-xs text-muted-foreground">+12% from last month</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600">₹12,450</div>
                            <p className="text-xs text-muted-foreground">3 vendors awaiting payment</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Successful Payouts</CardTitle>
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">142</div>
                            <p className="text-xs text-muted-foreground">Across 45 active vendors</p>
                        </CardContent>
                    </Card>
                </div>

                <DataTableView
                    title="Vendor Balance & Payouts"
                    columns={columns}
                    data={filteredPayouts}
                    onSearch={handleSearch}
                    actions={(item) => (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Payout Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleProcessPayment(item.id)} className="text-blue-600">
                                    <CreditCard className="mr-2 h-4 w-4" />
                                    Process Payout
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Receipt className="mr-2 h-4 w-4" />
                                    View Statement
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                />
            </div>
        </DefaultLayout>
    )
}

