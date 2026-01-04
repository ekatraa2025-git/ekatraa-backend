'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { createClient } from '@/utils/supabase/client'
import { MapPin, Loader2, MoreHorizontal, Eye, CheckCircle, Edit } from 'lucide-react'
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

export default function BookingsPage() {
    const [bookings, setBookings] = useState<any[]>([])
    const [filteredBookings, setFilteredBookings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchBookings = async () => {
            const res = await fetch('/api/admin/bookings')
            const data = await res.json()

            if (data && !data.error) {
                setBookings(data)
                setFilteredBookings(data)
            } else if (data.error) {
                console.error('API Error:', data.error)
            }
            setLoading(false)
        }
        fetchBookings()
    }, [])

    const handleSearch = (val: string) => {
        const filtered = bookings.filter(b =>
            b.customer_name?.toLowerCase().includes(val.toLowerCase()) ||
            b.id?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredBookings(filtered)
    }

    const columns = [
        { header: 'Booking ID', key: 'id', render: (val: string) => <span className="font-mono text-xs">{val.slice(0, 8)}...</span> },
        { header: 'Customer', key: 'customer_name' },
        { header: 'Vendor', key: 'vendor_name', render: (val: string) => val || 'Unassigned' },
        { header: 'Date', key: 'booking_date' },
        {
            header: 'Status',
            key: 'status',
            render: (val: string) => (
                <Badge variant={val === 'confirmed' ? 'secondary' : val === 'pending' ? 'outline' : 'secondary'} className="capitalize">
                    {val || 'N/A'}
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
                title="Bookings Management"
                description="Monitor and allocate customer bookings to vendors."
                columns={columns}
                data={filteredBookings}
                onSearch={handleSearch}
                addNewLink="/admin/bookings/new"
                addNewLabel="Add Booking"
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
                                <Link href={`/admin/bookings/${item.id}`} className="flex items-center">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Details
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/admin/locations" className="flex items-center">
                                    <MapPin className="mr-2 h-4 w-4" />
                                    Allocate Vendor
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-emerald-600 focus:bg-emerald-50 focus:text-emerald-600">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Confirm Booking
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
        </DefaultLayout>
    )
}

