'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter } from 'next/navigation'

export default function NewServicePage() {
    const [loading, setLoading] = useState(false)
    const [vendors, setVendors] = useState<{ label: string, value: any }[]>([])
    const router = useRouter()

    useEffect(() => {
        const fetchData = async () => {
            const venRes = await fetch('/api/admin/vendors?status=active')
            const venData = await venRes.json()

            if (venData && !venData.error) {
                setVendors(venData.map((v: any) => ({ label: v.business_name, value: v.id })))
            }
        }
        fetchData()
    }, [])

    const fields: any[] = [
        { name: 'vendor_id', label: 'Vendor', type: 'select', options: vendors, required: true, placeholder: 'Select a vendor' },
        { name: 'name', label: 'Service Name', type: 'text', required: true, placeholder: 'e.g. Catering, Photography' },
        { name: 'base_price', label: 'Starting Price', type: 'number', required: true, placeholder: '0.00' },
        { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Tell us about this service...' },
        { name: 'is_active', label: 'Is Active?', type: 'checkbox', initialValue: true },
    ]

    const handleSubmit = async (data: any) => {
        setLoading(true)
        const res = await fetch('/api/admin/services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        const result = await res.json()
        setLoading(false)

        if (result.error) {
            alert(result.error)
        } else {
            router.push('/admin/services')
        }
    }

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-270">
                <div className="mb-6">
                    <h2 className="text-title-md2 font-bold text-black dark:text-white">
                        Add New Service
                    </h2>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} title="Service Details" loading={loading} />
            </div>
        </DefaultLayout>
    )
}
