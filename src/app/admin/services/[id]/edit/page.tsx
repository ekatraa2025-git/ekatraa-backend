'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function EditServicePage() {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [serviceData, setServiceData] = useState<any>(null)
    const [vendors, setVendors] = useState<any[]>([])
    const router = useRouter()
    const { id } = useParams()

    useEffect(() => {
        const fetchData = async () => {
            const [serviceRes, vendorRes] = await Promise.all([
                fetch(`/api/admin/services/${id}`),
                fetch('/api/admin/vendors?status=active')
            ])

            const sData = await serviceRes.json()
            const vData = await vendorRes.json()

            if (vData && !vData.error) {
                setVendors(vData.map((v: any) => ({ label: v.business_name, value: v.id })))
            }

            if (sData.error) {
                alert(sData.error)
                router.push('/admin/services')
            } else {
                setServiceData(sData)
            }
            setFetching(false)
        }
        fetchData()
    }, [id])

    const fields: any[] = [
        { name: 'vendor_id', label: 'Vendor', type: 'select', options: vendors, required: true },
        { name: 'name', label: 'Service Name', type: 'text', required: true, placeholder: 'e.g. Catering, Photography' },
        { name: 'base_price', label: 'Starting Price', type: 'number', required: true, placeholder: '0.00' },
        { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Tell us about this service...' },
        { name: 'image_url', label: 'Service Image', type: 'file', uploadFolder: 'services', accept: 'image/*' },
        { name: 'is_active', label: 'Is Active?', type: 'checkbox' },
    ]

    const handleSubmit = async (data: any) => {
        setLoading(true)
        const res = await fetch(`/api/admin/services/${id}`, {
            method: 'PATCH',
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
                    <h2 className="text-3xl font-bold tracking-tight text-black dark:text-white">
                        Edit Service: {serviceData?.name}
                    </h2>
                    <p className="text-muted-foreground mt-2">Modify service details and pricing.</p>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} initialData={serviceData} title="Service Details" loading={loading} />
            </div>
        </DefaultLayout>
    )
}
