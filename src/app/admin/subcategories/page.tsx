'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { MoreHorizontal, Edit, Trash2, Tag, Layers } from 'lucide-react'
import { DataTableView } from '@/components/admin-panel/data-table-view'
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

export default function SubcategoriesPage() {
    const [subcategories, setSubcategories] = useState<any[]>([])
    const [filteredSubcategories, setFilteredSubcategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchSubcategories()
    }, [])

    const fetchSubcategories = async () => {
        const res = await fetch('/api/admin/subcategories')
        const data = await res.json()

        if (data && !data.error) {
            setSubcategories(data)
            setFilteredSubcategories(data)
        } else if (data?.error) {
            console.error('API Error:', data.error)
        }
        setLoading(false)
    }

    const handleSearch = (val: string) => {
        const filtered = subcategories.filter(s =>
            s.name?.toLowerCase().includes(val.toLowerCase()) ||
            s.category?.name?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredSubcategories(filtered)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this subcategory? This will also delete all associated service items.')) return

        const res = await fetch(`/api/admin/subcategories/${id}`, { method: 'DELETE' })
        const result = await res.json()

        if (result.error) {
            alert(result.error)
        } else {
            fetchSubcategories()
        }
    }

    const columns = [
        {
            header: 'Subcategory Name',
            key: 'name',
            render: (val: string) => (
                <div className="flex items-center gap-2 font-medium">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Tag className="h-4 w-4" />
                    </div>
                    {val}
                </div>
            )
        },
        {
            header: 'Parent Category',
            key: 'category',
            render: (val: any) => (
                <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span>{val?.name || 'N/A'}</span>
                </div>
            )
        },
        {
            header: 'Status',
            key: 'status',
            render: () => (
                <Badge variant="outline" className="capitalize">
                    Active
                </Badge>
            )
        },
    ]

    return (
        <DefaultLayout>
            <DataTableView
                title="Subcategories"
                description="Manage subcategories under vendor categories."
                columns={columns}
                data={filteredSubcategories}
                onSearch={handleSearch}
                addNewLink="/admin/subcategories/new"
                addNewLabel="Add Subcategory"
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
                                <Link href={`/admin/subcategories/${item.id}`} className="flex items-center">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Subcategory
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onClick={() => handleDelete(item.id)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Subcategory
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
        </DefaultLayout>
    )
}
