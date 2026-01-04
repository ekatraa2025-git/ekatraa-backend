'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import Form from '@/components/Common/Form'
import { useRouter } from 'next/navigation'

export default function NewBookingPage() {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const fields: any[] = [
        { name: 'customer_name', label: 'Customer Name', type: 'text', required: true, placeholder: 'Enter customer name' },
        { name: 'booking_date', label: 'Booking Date', type: 'date', required: true },
        { name: 'customer_email', label: 'Customer Email (Optional)', type: 'email', required: false, placeholder: 'customer@example.com' },
        { name: 'customer_phone', label: 'Customer Phone', type: 'text', placeholder: '+91 0000000000' },
        { name: 'details', label: 'Event Details', type: 'textarea', placeholder: 'Describe the event...' },
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
            initialValue: 'pending',
            required: true
        },
    ]

    const handleSubmit = async (data: any) => {
        setLoading(true)
        // Ensure vendor_id is not included - bookings are created without vendors
        delete data.vendor_id
        const res = await fetch('/api/admin/bookings', {
            method: 'POST',
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

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-270">
                <div className="mb-6">
                    <h2 className="text-title-md2 font-bold text-black dark:text-white">
                        Create New Booking
                    </h2>
                </div>
                <Form fields={fields} onSubmit={handleSubmit} title="Booking Information" loading={loading} />
            </div>
        </DefaultLayout>
    )
}
