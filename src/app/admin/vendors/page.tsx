'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { ConfirmDialog } from '@/components/Common/ConfirmDialog'
import { toast } from 'sonner'
import { DataTableView } from '@/components/admin-panel/data-table-view'
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
    const [defaultVendorLoading, setDefaultVendorLoading] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{id: string; name: string} | null>(null)

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

    useEffect(() => {
        fetchVendors()
    }, [])

    const ensureDefaultVendor = async () => {
        setDefaultVendorLoading(true)
        try {
            const res = await fetch('/api/admin/seed/default-vendor', { method: 'POST' })
            const data = await res.json()
            if (!res.ok || data.error) {
                toast.error(data.error || 'Could not create default vendor.')
                return
            }
            toast.success(data.message || 'Default vendor ready.')
            setLoading(true)
            await fetchVendors()
        } catch {
            toast.error('Network error.')
        } finally {
            setDefaultVendorLoading(false)
        }
    }

    const handleSearch = (val: string) => {
        const filtered = vendors.filter(v =>
            v.business_name?.toLowerCase().includes(val.toLowerCase()) ||
            v.owner_name?.toLowerCase().includes(val.toLowerCase()) ||
            v.email?.toLowerCase().includes(val.toLowerCase()) ||
            v.phone?.toLowerCase().includes(val.toLowerCase()) ||
            v.vendor_categories?.name?.toLowerCase().includes(val.toLowerCase()) ||
            v.location_display?.toLowerCase().includes(val.toLowerCase()) ||
            v.category?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredVendors(filtered)
    }

    const columns = [
        { header: 'Business Name', key: 'business_name' },
        {
            header: 'Catalogue Category',
            key: 'vendor_categories',
            render: (_val: any, row: any) =>
                row?.vendor_categories?.name ||
                row?.category ||
                <span className="text-muted-foreground italic text-xs">Uncategorized</span>
        },
        { header: 'Owner', key: 'owner_name' },
        {
            header: 'Phone',
            key: 'phone',
            render: (val: string) => val || <span className="text-muted-foreground italic text-xs">N/A</span>
        },
        {
            header: 'Service Area',
            key: 'location_display',
            render: (val: string) => val || <span className="text-muted-foreground italic text-xs">Not set</span>
        },
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
            <div className="mx-auto mb-6 flex max-w-270 flex-col gap-3 rounded-lg border border-stroke bg-white p-4 shadow-sm dark:border-strokedark dark:bg-boxdark sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-black dark:text-white">Default demo vendor</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Creates auth + vendor row if missing (email/password + OTP when configured). Uses{' '}
                        <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">DEFAULT_VENDOR_*</code> env vars.
                    </p>
                </div>
                <Button type="button" variant="secondary" disabled={defaultVendorLoading} onClick={ensureDefaultVendor}>
                    {defaultVendorLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Working…
                        </>
                    ) : (
                        'Ensure default vendor'
                    )}
                </Button>
            </div>
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

