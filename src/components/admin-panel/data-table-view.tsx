'use client'

import React, { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Trash2, Edit } from 'lucide-react'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/Common/ConfirmDialog'

interface Column {
    header: string
    key: string
    render?: (value: any, item: any) => React.ReactNode
}

interface DataTableViewProps {
    title: string
    description?: string
    columns: Column[]
    data: any[]
    searchKey?: string
    onSearch?: (value: string) => void
    addNewLink?: string
    addNewLabel?: string
    actions?: (item: any) => React.ReactNode
    /** Enable row selection and bulk delete. idKey is the property used as row id (default 'id'). */
    selectable?: boolean
    idKey?: string
    onBulkDelete?: (ids: string[]) => Promise<void>
    /** Optional: base path for edit link per row (e.g. '/admin/vendors'). Link becomes {editLinkBase}/{id}{editLinkSuffix}. */
    editLinkBase?: string
    /** Suffix after id for edit link (e.g. '' for vendors, '/edit' for event-types). Default '/edit'. */
    editLinkSuffix?: string
}

export function DataTableView({
    title,
    description,
    columns,
    data,
    onSearch,
    addNewLink,
    addNewLabel = 'Add New',
    actions,
    selectable = false,
    idKey = 'id',
    onBulkDelete,
    editLinkBase,
    editLinkSuffix = '/edit',
}: DataTableViewProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkDeleting, setBulkDeleting] = useState(false)
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

    const toggleRow = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        if (selectedIds.size === data.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(data.map((item) => String(item[idKey]))))
        }
    }

    const handleBulkDelete = async () => {
        if (!onBulkDelete || selectedIds.size === 0) return
        setBulkDeleting(true)
        try {
            await onBulkDelete(Array.from(selectedIds))
            setSelectedIds(new Set())
        } finally {
            setBulkDeleting(false)
            setBulkDeleteOpen(false)
        }
    }

    const totalCols = columns.length + (actions ? 1 : 0) + (selectable ? 1 : 0) + (editLinkBase ? 1 : 0)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
                    {description && <p className="text-muted-foreground">{description}</p>}
                </div>
                <div className="flex items-center gap-2">
                    {selectable && onBulkDelete && selectedIds.size > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setBulkDeleteOpen(true)}
                            disabled={bulkDeleting}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {bulkDeleting ? 'Deleting...' : `Delete selected (${selectedIds.size})`}
                        </Button>
                    )}
                    {addNewLink && (
                        <Button asChild>
                            <Link href={addNewLink}>
                                <Plus className="mr-2 h-4 w-4" />
                                {addNewLabel}
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={`Search ${title.toLowerCase()}...`}
                                className="pl-9"
                                onChange={(e) => onSearch?.(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {selectable && (
                                        <TableHead className="w-10">
                                            <input
                                                type="checkbox"
                                                checked={data.length > 0 && selectedIds.size === data.length}
                                                onChange={toggleAll}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                        </TableHead>
                                    )}
                                    {editLinkBase && <TableHead className="w-10">Edit</TableHead>}
                                    {columns.map((col, index) => (
                                        <TableHead key={index}>{col.header}</TableHead>
                                    ))}
                                    {actions && <TableHead className="text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={totalCols} className="h-24 text-center">
                                            No records found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((item, index) => {
                                        const rowId = String(item[idKey])
                                        return (
                                            <TableRow key={item[idKey] ?? index}>
                                                {selectable && (
                                                    <TableCell className="w-10">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(rowId)}
                                                            onChange={() => toggleRow(rowId)}
                                                            className="h-4 w-4 rounded border-gray-300"
                                                        />
                                                    </TableCell>
                                                )}
                                                {editLinkBase && (
                                                    <TableCell className="w-10">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                            <Link href={`${editLinkBase}/${rowId}${editLinkSuffix}`}>
                                                                <Edit className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                    </TableCell>
                                                )}
                                                {columns.map((col, colIndex) => (
                                                    <TableCell key={colIndex}>
                                                        {col.render ? col.render(item[col.key], item) : item[col.key]}
                                                    </TableCell>
                                                ))}
                                                {actions && (
                                                    <TableCell className="text-right">
                                                        {actions(item)}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title="Delete Selected Items"
                description={`This will permanently delete ${selectedIds.size} selected item(s) and all related data. This action cannot be undone.`}
                onConfirm={handleBulkDelete}
            />
        </div>
    )
}
