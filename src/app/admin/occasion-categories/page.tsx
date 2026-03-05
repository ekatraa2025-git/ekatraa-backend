'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { Loader2 } from 'lucide-react'

export default function OccasionCategoriesPage() {
    const [items, setItems] = useState<{ occasion_id: string; category_id: string; occasions?: { id: string; name: string }; categories?: { id: string; name: string } }[]>([])
    const [filtered, setFiltered] = useState<typeof items>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/admin/occasion-categories')
            .then((r) => r.json())
            .then((data) => {
                if (!data.error) {
                    const list = Array.isArray(data) ? data : []
                    setItems(list)
                    setFiltered(list)
                }
                setLoading(false)
            })
    }, [])

    const handleSearch = (val: string) => {
        const v = val.toLowerCase()
        const f = items.filter(
            (e) =>
                (e.occasions?.name ?? e.occasion_id).toLowerCase().includes(v) ||
                (e.categories?.name ?? e.category_id).toLowerCase().includes(v)
        )
        setFiltered(f)
    }

    const columns = [
        { header: 'Occasion', key: 'occasion_id', render: (_: unknown, row: typeof items[0]) => row.occasions?.name ?? row.occasion_id },
        { header: 'Category', key: 'category_id', render: (_: unknown, row: typeof items[0]) => row.categories?.name ?? row.category_id },
    ]

    if (loading) {
        return (
            <DefaultLayout>
                <div className="flex h-60 items-center justify-center">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
            </DefaultLayout>
        )
    }

    return (
        <DefaultLayout>
            <DataTableView
                title="Occasion–Categories"
                description="Many-to-many mapping: which categories are shown for each occasion. Manage via API or add UI to create/delete links."
                columns={columns}
                data={filtered}
                onSearch={handleSearch}
            />
        </DefaultLayout>
    )
}
