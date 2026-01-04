'use client'

import React from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter } from 'next/navigation'

export default function NewVendorPage() {
    const [loading, setLoading] = React.useState(false)
    const [categories, setCategories] = React.useState<{ label: string, value: any }[]>([])
    const router = useRouter()

    React.useEffect(() => {
        const fetchCategories = async () => {
            const res = await fetch('/api/admin/categories')
            const data = await res.json()
            if (data && !data.error) {
                setCategories(data.map((c: any) => ({ label: c.name, value: c.id })))
            }
        }
        fetchCategories()
    }, [])

    const fields: any[] = [
        { name: 'business_name', label: 'Business Name', type: 'text', required: true, placeholder: 'Enter business name' },
        { name: 'category_id', label: 'Vendor Category', type: 'select', options: categories, required: true },
        { name: 'owner_name', label: 'Owner Name', type: 'text', required: true, placeholder: 'Enter owner name' },
        { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'vendor@example.com' },
        { name: 'phone', label: 'Phone', type: 'text', placeholder: '+91 0000000000' },
        { name: 'address', label: 'Address', type: 'textarea', placeholder: 'Full business address (City will be auto-extracted)', required: true },
        { name: 'city', label: 'City (Auto-extracted from address)', type: 'text', placeholder: 'Will be extracted from address' },
        { name: 'service_area', label: 'Service Area', type: 'text', placeholder: 'e.g. Bhubaneswar, India' },
        {
            name: 'status',
            label: 'Status',
            type: 'switch',
            switchLabels: { on: 'Active', off: 'Pending' },
            initialValue: false,
            required: true
        },
    ]

    const handleSubmit = async (data: any) => {
        setLoading(true)
        // Convert switch boolean to status string
        if (typeof data.status === 'boolean') {
            data.status = data.status ? 'active' : 'pending'
        }
        const res = await fetch('/api/admin/vendors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        const result = await res.json()
        setLoading(false)

        if (result.error) {
            alert(result.error)
        } else {
            router.push('/admin/vendors')
        }
    }

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-270">
                <div className="mb-6">
                    <h2 className="text-title-md2 font-bold text-black dark:text-white">
                        Add New Vendor
                    </h2>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} title="Vendor Information" loading={loading} />
            </div>
        </DefaultLayout>
    )
}
