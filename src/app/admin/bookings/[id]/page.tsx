'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function EditBookingPage() {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [bookingData, setBookingData] = useState<any>(null)
    const router = useRouter()
    const { id } = useParams()

    useEffect(() => {
        const fetchData = async () => {
            const bookingRes = await fetch(`/api/admin/bookings/${id}`)
            const bData = await bookingRes.json()

            if (bData.error) {
                alert(bData.error)
                router.push('/admin/bookings')
            } else {
                setBookingData(bData)
            }
            setFetching(false)
        }
        fetchData()
    }, [id, router])

    const fields: any[] = [
        { name: 'customer_name', label: 'Customer Name', type: 'text', required: true },
        { name: 'booking_date', label: 'Booking Date', type: 'date', required: true },
        { name: 'customer_email', label: 'Customer Email (Optional)', type: 'email', required: false },
        { name: 'customer_phone', label: 'Customer Phone', type: 'text' },
        { name: 'details', label: 'Event Details', type: 'textarea' },
        {
            name: 'status',
            label: 'Status',
            type: 'select',
            options: [
                { label: 'Pending', value: 'pending' },
                { label: 'Confirmed', value: 'confirmed' },
                { label: 'Completed', value: 'completed' },
                { label: 'Cancelled', value: 'cancelled' },
                { label: 'Allocated', value: 'allocated' }
            ],
            required: true
        },
    ]

    const handleSubmit = async (data: any) => {
        setLoading(true)
        // Remove vendor_id - vendor allocation is done only in allocation page
        delete data.vendor_id
        const res = await fetch(`/api/admin/bookings/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        const result = await res.json()
        setLoading(false)

        if (result.error) {
            alert(result.error)
        } else {
            router.push('/admin/bookings')
        }
    }

    const initialData = bookingData || {}

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
                        Edit Booking: {bookingData?.customer_name}
                    </h2>
                    <p className="text-muted-foreground mt-2">Modify booking details and status.</p>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} initialData={initialData} title="Booking Information" loading={loading} />
            </div>
        </DefaultLayout>
    )
}

