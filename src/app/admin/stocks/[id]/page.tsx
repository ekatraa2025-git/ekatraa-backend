'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function EditStockPage() {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [stockData, setStockData] = useState<any>(null)
    const [subcategories, setSubcategories] = useState<any[]>([])
    const router = useRouter()
    const { id } = useParams()

    useEffect(() => {
        const fetchData = async () => {
            const [stockRes, subcatRes] = await Promise.all([
                fetch(`/api/admin/stocks/${id}`),
                fetch('/api/admin/subcategories')
            ])

            const stockResult = await stockRes.json()
            const subcatResult = await subcatRes.json()

            if (stockResult.error) {
                alert(stockResult.error)
                router.push('/admin/stocks')
            } else {
                setStockData(stockResult)
            }

            if (subcatResult && !subcatResult.error) {
                setSubcategories(subcatResult)
            }

            setFetching(false)
        }
        fetchData()
    }, [id])

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
        { name: 'price_basic', label: 'Basic Price (₹)', type: 'number', required: true, placeholder: 'e.g. 300' },
        { name: 'price_standard', label: 'Standard Price (₹)', type: 'number', required: true, placeholder: 'e.g. 500' },
        { name: 'price_premium', label: 'Premium Price (₹)', type: 'number', required: true, placeholder: 'e.g. 800' },
    ]

    const handleSubmit = async (data: any) => {
        setLoading(true)
        const res = await fetch(`/api/admin/stocks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                price_basic: parseFloat(data.price_basic) || 0,
                price_standard: parseFloat(data.price_standard) || 0,
                price_premium: parseFloat(data.price_premium) || 0,
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
                        Edit Service Item: {stockData?.name}
                    </h2>
                    <p className="text-muted-foreground">Modify service item information and pricing below.</p>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} initialData={stockData} title="Service Item Information" loading={loading} />
            </div>
        </DefaultLayout>
    )
}
