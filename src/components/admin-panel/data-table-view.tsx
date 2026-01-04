'use client'

import React from 'react'
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
    CardTitle,
    CardDescription
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search } from 'lucide-react'
import Link from 'next/link'

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
}

export function DataTableView({
    title,
    description,
    columns,
    data,
    searchKey,
    onSearch,
    addNewLink,
    addNewLabel = 'Add New',
    actions
}: DataTableViewProps) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
                    {description && <p className="text-muted-foreground">{description}</p>}
                </div>
                {addNewLink && (
                    <Button asChild>
                        <Link href={addNewLink}>
                            <Plus className="mr-2 h-4 w-4" />
                            {addNewLabel}
                        </Link>
                    </Button>
                )}
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
                                    {columns.map((col, index) => (
                                        <TableHead key={index}>{col.header}</TableHead>
                                    ))}
                                    {actions && <TableHead className="text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length + (actions ? 1 : 0)}
                                            className="h-24 text-center"
                                        >
                                            No records found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((item, index) => (
                                        <TableRow key={index}>
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
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
