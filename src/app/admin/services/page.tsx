'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { ConfirmDialog } from '@/components/Common/ConfirmDialog'
import { toast } from 'sonner'
import { Edit, Trash2, Loader2, MoreHorizontal, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Card,
    CardContent,
    CardHeader,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

export default function ServicesPage() {
    const [services, setServices] = useState<any[]>([])
    const [filteredServices, setFilteredServices] = useState<any[]>([])
    const [vendors, setVendors] = useState<{ label: string, value: any }[]>([])
    const [selectedVendor, setSelectedVendor] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkDeleting, setBulkDeleting] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{id: string; name: string} | null>(null)
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            const [servicesRes, vendorsRes] = await Promise.all([
                fetch('/api/admin/services'),
                fetch('/api/admin/vendors?status=active')
            ])
            const servicesData = await servicesRes.json()
            const vendorsData = await vendorsRes.json()

            if (servicesData && !servicesData.error) {
                setServices(servicesData)
                setFilteredServices(servicesData)
            } else if (servicesData.error) {
                console.error('API Error:', servicesData.error)
            }

            if (vendorsData && !vendorsData.error) {
                setVendors([
                    { label: 'All Vendors', value: '' },
                    ...vendorsData.map((v: any) => ({ label: v.business_name, value: v.id }))
                ])
            }

            setLoading(false)
        }
        fetchData()
    }, [])

    useEffect(() => {
        const fetchServices = async () => {
            const url = selectedVendor 
                ? `/api/admin/services?vendor_id=${selectedVendor}`
                : '/api/admin/services'
            const res = await fetch(url)
            const data = await res.json()

            if (data && !data.error) {
                setServices(data)
                setFilteredServices(data)
            } else if (data.error) {
                console.error('API Error:', data.error)
            }
        }
        if (!loading) {
            fetchServices()
        }
    }, [selectedVendor, loading])

    const handleSearch = (val: string) => {
        const filtered = services.filter(s =>
            s.name?.toLowerCase().includes(val.toLowerCase()) ||
            s.vendor?.business_name?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredServices(filtered)
    }

    const columns = [
        { header: 'Service Name', key: 'name' },
        { header: 'Vendor', key: 'vendor', render: (val: any) => val?.business_name || 'N/A' },
        { header: 'Starting Price', key: 'base_price', render: (val: number) => `₹${val || 0}` },
        {
            header: 'Status',
            key: 'is_active',
            render: (val: boolean) => (
                <Badge variant={val ? 'secondary' as const : 'destructive' as const}>
                    {val ? 'Active' : 'Inactive'}
                </Badge>
            )
        },
    ]

    const handleDelete = (id: string, name: string) => {
        setDeleteTarget({ id, name })
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        const res = await fetch(`/api/admin/services/${deleteTarget.id}`, { method: 'DELETE' })
        const result = await res.json()
        if (result.error) {
            toast.error(result.error)
        } else {
            setServices(services.filter(s => s.id !== deleteTarget.id))
            setFilteredServices(filteredServices.filter(s => s.id !== deleteTarget.id))
            toast.success('Deleted successfully')
        }
        setDeleteTarget(null)
    }

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return
        setBulkDeleteConfirm(true)
    }

    const confirmBulkDelete = async () => {
        setBulkDeleting(true)
        try {
            await Promise.all(Array.from(selectedIds).map((id) => fetch(`/api/admin/services/${id}`, { method: 'DELETE' }).then((r) => r.json())))
            setServices((prev) => prev.filter((s) => !selectedIds.has(s.id)))
            setFilteredServices((prev) => prev.filter((s) => !selectedIds.has(s.id)))
            setSelectedIds(new Set())
            toast.success('Deleted successfully')
        } finally {
            setBulkDeleting(false)
            setBulkDeleteConfirm(false)
        }
    }

    const toggleRow = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        if (selectedIds.size === filteredServices.length) setSelectedIds(new Set())
        else setSelectedIds(new Set(filteredServices.map((s) => s.id)))
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
            <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Services Management</h2>
                        <p className="text-muted-foreground">Browse and manage the catalog of services offered by vendors.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleting}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                {bulkDeleting ? 'Deleting...' : `Delete selected (${selectedIds.size})`}
                            </Button>
                        )}
                        <Button asChild>
                            <Link href="/admin/services/new">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Service
                            </Link>
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search services..."
                                    className="pl-9"
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                            </div>
                            <select
                                value={selectedVendor}
                                onChange={(e) => setSelectedVendor(e.target.value)}
                                className="flex h-9 w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                {vendors.map((vendor) => (
                                    <option key={vendor.value} value={vendor.value}>
                                        {vendor.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">
                                            <input type="checkbox" checked={filteredServices.length > 0 && selectedIds.size === filteredServices.length} onChange={toggleAll} className="h-4 w-4 rounded border-gray-300" />
                                        </TableHead>
                                        <TableHead className="w-10">Edit</TableHead>
                                        {columns.map((col, index) => (
                                            <TableHead key={index}>{col.header}</TableHead>
                                        ))}
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredServices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={columns.length + 3} className="h-24 text-center">
                                                No records found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredServices.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="w-10">
                                                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleRow(item.id)} className="h-4 w-4 rounded border-gray-300" />
                                                </TableCell>
                                                <TableCell className="w-10">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                        <Link href={`/admin/services/${item.id}/edit`}><Edit className="h-4 w-4" /></Link>
                                                    </Button>
                                                </TableCell>
                                                {columns.map((col, colIndex) => (
                                                    <TableCell key={colIndex}>
                                                        {col.render ? col.render(item[col.key], item) : item[col.key]}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant={"ghost" as const} className="h-8 w-8 p-0">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/admin/services/${item.id}/edit`} className="flex items-center">
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Edit Details
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => handleDelete(item.id, item.name)}
                                                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete Service
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Delete Service"
                description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
            />
            <ConfirmDialog
                open={bulkDeleteConfirm}
                onOpenChange={(open) => !open && setBulkDeleteConfirm(false)}
                title="Delete Selected Services"
                description={`Are you sure you want to delete ${selectedIds.size} selected service(s)? This action cannot be undone.`}
                onConfirm={confirmBulkDelete}
            />
        </DefaultLayout>
    )
}

