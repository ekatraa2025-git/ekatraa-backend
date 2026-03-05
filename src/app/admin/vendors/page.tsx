'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { ConfirmDialog } from '@/components/Common/ConfirmDialog'
import { toast } from 'sonner'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { createClient } from '@/utils/supabase/client'
import { Edit, Trash2, Loader2, MoreHorizontal, Eye } from 'lucide-react'
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

export default function VendorsPage() {
    const [vendors, setVendors] = useState<any[]>([])
    const [filteredVendors, setFilteredVendors] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<{id: string; name: string} | null>(null)
    const supabase = createClient()

    useEffect(() => {
        const fetchVendors = async () => {
            const res = await fetch('/api/admin/vendors')
            const data = await res.json()

            if (data && !data.error) {
                setVendors(data)
                setFilteredVendors(data)
            } else if (data.error) {
                console.error('API Error:', data.error)
            }
            setLoading(false)
        }
        fetchVendors()
    }, [])

    const handleSearch = (val: string) => {
        const filtered = vendors.filter(v =>
            v.business_name?.toLowerCase().includes(val.toLowerCase()) ||
            v.owner_name?.toLowerCase().includes(val.toLowerCase()) ||
            v.email?.toLowerCase().includes(val.toLowerCase()) ||
            v.vendor_categories?.name?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredVendors(filtered)
    }

    const columns = [
        { header: 'Business Name', key: 'business_name' },
        { header: 'Category', key: 'vendor_categories', render: (val: any) => val?.name || <span className="text-muted-foreground italic text-xs">Uncategorized</span> },
        { header: 'Owner', key: 'owner_name' },
        { header: 'Email', key: 'email' },
        {
            header: 'Status',
            key: 'status',
            render: (val: string) => (
                <Badge variant={val === 'active' ? 'secondary' : val === 'pending' ? 'outline' : 'destructive'} className="capitalize">
                    {val || 'N/A'}
                </Badge>
            )
        },
    ]

    const handleDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name })
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        const res = await fetch(`/api/admin/vendors/${deleteTarget.id}`, { method: 'DELETE' })
        const result = await res.json()
        if (result.error) {
            toast.error(result.error)
        } else {
            setVendors(vendors.filter(v => v.id !== deleteTarget.id))
            setFilteredVendors(filteredVendors.filter(v => v.id !== deleteTarget.id))
            toast.success('Deleted successfully')
        }
        setDeleteTarget(null)
    }

    const handleBulkDelete = async (ids: string[]) => {
        await Promise.all(ids.map((id) => fetch(`/api/admin/vendors/${id}`, { method: 'DELETE' }).then((r) => r.json())))
        setVendors((prev) => prev.filter((v) => !ids.includes(v.id)))
        setFilteredVendors((prev) => prev.filter((v) => !ids.includes(v.id)))
    }

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
                title="Vendors Management"
                description="View and manage all registered service providers."
                columns={columns}
                data={filteredVendors}
                onSearch={handleSearch}
                addNewLink="/admin/vendors/new"
                addNewLabel="Add Vendor"
                selectable
                onBulkDelete={handleBulkDelete}
                editLinkBase="/admin/vendors"
                editLinkSuffix=""
                actions={(item) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/vendors/${item.id}`} className="flex items-center">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Details
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => handleDelete(item.id, item.business_name)}
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Vendor
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Delete Vendor"
                description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
            />
        </DefaultLayout>
    )
}

