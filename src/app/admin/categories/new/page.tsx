'use client'

import React from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter } from 'next/navigation'

export default function NewCategoryPage() {
    const [loading, setLoading] = React.useState(false)
    const router = useRouter()

    const fields: any[] = [
        { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Wedding Planner, Caterer' },
        { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description of the category' },
    ]

    const handleSubmit = async (data: any) => {
        setLoading(true)
        const res = await fetch('/api/admin/categories', {
            method: 'POST',
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

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-270">
                <div className="mb-6">
                    <h2 className="text-3xl font-bold tracking-tight text-white">
                        Add New Category
                    </h2>
                    <p className="text-muted-foreground">Define a new category for your vendors.</p>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} title="Category Details" loading={loading} />
            </div>
        </DefaultLayout>
    )
}
