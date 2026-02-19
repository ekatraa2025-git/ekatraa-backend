'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function NewStockPage() {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [subcategories, setSubcategories] = useState<any[]>([])
    const router = useRouter()

    useEffect(() => {
        const fetchSubcategories = async () => {
            const res = await fetch('/api/admin/subcategories')
            const data = await res.json()
            if (data && !data.error) {
                setSubcategories(data)
            }
            setFetching(false)
        }
        fetchSubcategories()
    }, [])

    const fields: any[] = [
        {
            name: 'subcategory_id',
            label: 'Subcategory',
            type: 'select',
            required: true,
            options: subcategories.map(s => ({
                label: `${s.category?.name || 'Unknown'} → ${s.name}`,
                value: s.id
            }))
        },
        { name: 'name', label: 'Service Item Name', type: 'text', required: true, placeholder: 'e.g. Bridal, Light Make Up, Eye Fix' },
        { name: 'price_classic_value', label: 'Classic Value (₹)', type: 'number', required: true, placeholder: 'e.g. 300' },
        { name: 'price_signature', label: 'Signature (₹)', type: 'number', required: true, placeholder: 'e.g. 500' },
        { name: 'price_prestige', label: 'Prestige (₹)', type: 'number', required: true, placeholder: 'e.g. 800' },
        { name: 'price_royal', label: 'Royal (₹)', type: 'number', required: false, placeholder: 'e.g. 1200' },
        { name: 'price_imperial', label: 'Imperial (₹)', type: 'number', required: false, placeholder: 'e.g. 2000' },
    ]

    const handleSubmit = async (data: any) => {
        setLoading(true)
        const res = await fetch('/api/admin/stocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                price_classic_value: parseFloat(data.price_classic_value) || 0,
                price_signature: parseFloat(data.price_signature) || 0,
                price_prestige: parseFloat(data.price_prestige) || 0,
                price_royal: parseFloat(data.price_royal) || 0,
                price_imperial: parseFloat(data.price_imperial) || 0,
            })
        })
        const result = await res.json()
        setLoading(false)

        if (result.error) {
            alert(result.error)
        } else {
            router.push('/admin/stocks')
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
                        Add New Service Item
                    </h2>
                    <p className="text-muted-foreground">Create a service item with tiered pricing under a subcategory.</p>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} title="Service Item Details" loading={loading} />
            </div>
        </DefaultLayout>
    )
}
