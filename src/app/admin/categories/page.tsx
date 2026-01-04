'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { MoreHorizontal, Eye, Edit, Trash2, Tag, Layers } from 'lucide-react'
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

export default function CategoriesPage() {
    const [categories, setCategories] = useState<any[]>([])
    const [filteredCategories, setFilteredCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchCategories()
    }, [])

    const fetchCategories = async () => {
        const res = await fetch('/api/admin/categories')
        const data = await res.json()

        if (data && !data.error) {
            setCategories(data)
            setFilteredCategories(data)
        } else if (data.error) {
            console.error('API Error:', data.error)
        }
        setLoading(false)
    }

    const handleSearch = (val: string) => {
        const filtered = categories.filter(c =>
            c.name?.toLowerCase().includes(val.toLowerCase()) ||
            c.description?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredCategories(filtered)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this category?')) return

        const res = await fetch(`/api/admin/categories/${id}`, {
            method: 'DELETE'
        })
        const result = await res.json()

        if (result.error) {
            alert(result.error)
        } else {
            fetchCategories()
        }
    }

    const columns = [
        {
            header: 'Category Name',
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
            header: 'Description',
            key: 'description',
            render: (val: string) => <span className="text-muted-foreground line-clamp-1 max-w-[300px]">{val || 'No description provided'}</span>
        },
        {
            header: 'Status',
            key: 'status',
            render: (val: string) => (
                <Badge variant="outline" className="capitalize">
                    Active
                </Badge>
            )
        },
    ]

    return (
        <DefaultLayout>
            <DataTableView
                title="Vendor Categories"
                description="Organize and manage service categories for your vendors."
                columns={columns}
                data={filteredCategories}
                onSearch={handleSearch}
                addNewLink="/admin/categories/new"
                addNewLabel="Add Category"
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
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/categories/${item.id}`} className="flex items-center">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Category
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onClick={() => handleDelete(item.id)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Category
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            />
        </DefaultLayout>
    )
}
