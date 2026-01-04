'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function EditVendorPage() {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [categories, setCategories] = useState<{ label: string, value: any }[]>([])
    const [vendorData, setVendorData] = useState<any>(null)
    const router = useRouter()
    const { id } = useParams()

    const fields: any[] = [
        { name: 'business_name', label: 'Business Name', type: 'text', required: true },
        { name: 'category_id', label: 'Vendor Category', type: 'select', options: categories, required: true },
        { name: 'owner_name', label: 'Owner Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Phone', type: 'text' },
        { name: 'address', label: 'Address', type: 'textarea', placeholder: 'Full business address (City will be auto-extracted if updated)' },
        { name: 'city', label: 'City (Auto-extracted from address)', type: 'text', placeholder: 'Will be extracted from address' },
        { name: 'service_area', label: 'Service Area', type: 'text' },
        {
            name: 'status',
            label: 'Status',
            type: 'switch',
            switchLabels: { on: 'Active', off: 'Pending' },
            required: true
        },
    ]

    useEffect(() => {
        const fetchInitialData = async () => {
            const [vendorRes, categoryRes] = await Promise.all([
                fetch(`/api/admin/vendors/${id}`),
                fetch('/api/admin/categories')
            ])

            const vendorData = await vendorRes.json()
            const categoriesData = await categoryRes.json()

            if (categoriesData && !categoriesData.error) {
                setCategories(categoriesData.map((c: any) => ({ label: c.name, value: c.id })))
            }

            if (vendorData.error) {
                alert(vendorData.error)
                router.push('/admin/vendors')
            } else {
                setVendorData(vendorData)
            }
            setFetching(false)
        }
        fetchInitialData()
    }, [id, router])

    const handleSubmit = async (data: any) => {
        setLoading(true)
        // Convert switch boolean to status string
        if (typeof data.status === 'boolean') {
            data.status = data.status ? 'active' : 'pending'
        }
        const res = await fetch(`/api/admin/vendors/${id}`, {
            method: 'PATCH',
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

    if (fetching) return (
        <DefaultLayout>
            <div className="flex h-60 items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" />
            </div>
        </DefaultLayout>
    )

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-270">
                <div className="mb-6">
                    <h2 className="text-title-md2 font-bold text-black dark:text-white">
                        Edit Vendor: {vendorData?.business_name}
                    </h2>
                </div>
                <Form 
                    fields={fields} 
                    onSubmit={handleSubmit} 
                    initialData={vendorData ? {
                        ...vendorData,
                        status: vendorData.status === 'active'
                    } : {}} 
                    title="Vendor Information" 
                    loading={loading} 
                />
            </div>
        </DefaultLayout>
    )
}
