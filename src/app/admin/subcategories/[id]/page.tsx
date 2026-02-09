'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function EditSubcategoryPage() {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [subcategoryData, setSubcategoryData] = useState<any>(null)
    const [categories, setCategories] = useState<any[]>([])
    const router = useRouter()
    const { id } = useParams()

    useEffect(() => {
        const fetchData = async () => {
            const [subcatRes, catRes] = await Promise.all([
                fetch(`/api/admin/subcategories/${id}`),
                fetch('/api/admin/categories')
            ])

            const subcatData = await subcatRes.json()
            const catData = await catRes.json()

            if (subcatData.error) {
                alert(subcatData.error)
                router.push('/admin/subcategories')
            } else {
                setSubcategoryData(subcatData)
            }

            if (catData && !catData.error) {
                setCategories(catData)
            }

            setFetching(false)
        }
        fetchData()
    }, [id])

    const fields: any[] = [
        {
            name: 'category_id',
            label: 'Parent Category',
            type: 'select',
            required: true,
            options: categories.map(c => ({ label: c.name, value: c.id }))
        },
        { name: 'name', label: 'Subcategory Name', type: 'text', required: true, placeholder: 'e.g. Local Salons, Bridal Studio' },
    ]

    const handleSubmit = async (data: any) => {
        setLoading(true)
        const res = await fetch(`/api/admin/subcategories/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        const result = await res.json()
        setLoading(false)

        if (result.error) {
            alert(result.error)
        } else {
            router.push('/admin/subcategories')
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
                        Edit Subcategory: {subcategoryData?.name}
                    </h2>
                    <p className="text-muted-foreground">Modify subcategory information below.</p>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} initialData={subcategoryData} title="Subcategory Information" loading={loading} />
            </div>
        </DefaultLayout>
    )
}
