'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function EditCategoryPage() {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [categoryData, setCategoryData] = useState<any>(null)
    const router = useRouter()
    const { id } = useParams()

    const fields: any[] = [
        { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Wedding Planner, Caterer' },
        { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description of the category' },
    ]

    useEffect(() => {
        const fetchCategory = async () => {
            const res = await fetch(`/api/admin/categories/${id}`)
            const data = await res.json()
            if (data.error) {
                alert(data.error)
                router.push('/admin/categories')
            } else {
                setCategoryData(data)
            }
            setFetching(false)
        }
        fetchCategory()
    }, [id])

    const handleSubmit = async (data: any) => {
        setLoading(true)
        const res = await fetch(`/api/admin/categories/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        const result = await res.json()
        setLoading(false)

        if (result.error) {
            alert(result.error)
        } else {
            router.push('/admin/categories')
        }
    }

    if (fetching) return (
        <DefaultLayout>
            <div className="flex h-60 items-center justify-center">
                <Loader2 className="animate-spin text-primary w-8 h-8" />
            </div>
        </DefaultLayout>
    )

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-270">
                <div className="mb-6">
                    <h2 className="text-3xl font-bold tracking-tight text-white">
                        Edit Category: {categoryData?.name}
                    </h2>
                    <p className="text-muted-foreground">Modify category information below.</p>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} initialData={categoryData} title="Category Information" loading={loading} />
            </div>
        </DefaultLayout>
    )
}
