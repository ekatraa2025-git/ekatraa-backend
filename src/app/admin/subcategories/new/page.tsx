'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function NewSubcategoryPage() {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [categories, setCategories] = useState<any[]>([])
    const router = useRouter()

    useEffect(() => {
        const fetchCategories = async () => {
            const res = await fetch('/api/admin/categories')
            const data = await res.json()
            if (data && !data.error) {
                setCategories(data)
            }
            setFetching(false)
        }
        fetchCategories()
    }, [])

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
        const res = await fetch('/api/admin/subcategories', {
            method: 'POST',
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
                        Add New Subcategory
                    </h2>
                    <p className="text-muted-foreground">Create a subcategory under an existing vendor category.</p>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} title="Subcategory Details" loading={loading} />
            </div>
        </DefaultLayout>
    )
}
