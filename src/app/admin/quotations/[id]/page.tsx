'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, CheckCircle, XCircle, Calendar, User, MapPin, Phone, Mail, FileText, Building2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card'
import { format } from 'date-fns'

export default function QuotationDetailPage() {
    const { id } = useParams()
    const router = useRouter()
    const [quotation, setQuotation] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        const fetchQuotation = async () => {
            const res = await fetch(`/api/admin/quotations/${id}`)
            const data = await res.json()

            if (data.error) {
                alert(data.error)
                router.push('/admin/quotations')
            } else {
                setQuotation(data)
            }
            setLoading(false)
        }
        fetchQuotation()
    }, [id, router])

    const handleStatusUpdate = async (status: 'accepted' | 'rejected') => {
        if (!confirm(`Are you sure you want to ${status} this quotation?`)) {
            return
        }

        setProcessing(true)
        try {
            const res = await fetch(`/api/admin/quotations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            })

            const result = await res.json()

            if (result.error) {
                alert(result.error)
            } else {
                setQuotation(result)
                alert(`Quotation ${status} successfully!`)
            }
        } catch (error: any) {
            alert(`Failed to update quotation: ${error.message}`)
        } finally {
            setProcessing(false)
        }
    }

    if (loading) {
        return (
            <DefaultLayout>
                <div className="flex h-60 items-center justify-center">
                    <Loader2 className="animate-spin text-primary w-8 h-8" />
                </div>
            </DefaultLayout>
        )
    }

    if (!quotation) {
        return (
            <DefaultLayout>
                <div className="flex h-60 items-center justify-center">
                    <p className="text-muted-foreground">Quotation not found</p>
                </div>
            </DefaultLayout>
        )
    }

    return (
        <DefaultLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Quotation Details</h2>
                        <p className="text-muted-foreground">View and manage quotation proposal</p>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Quotation Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Quotation Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Quotation ID</p>
                                <p className="font-mono text-sm">{quotation.id}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <Badge variant={quotation.status === 'accepted' ? 'secondary' : quotation.status === 'rejected' ? 'destructive' : 'outline'}>
                                    {quotation.status || 'Pending'}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Amount</p>
                                <p className="text-2xl font-bold text-primary">₹{quotation.total_amount || 0}</p>
                            </div>
                            {quotation.valid_until && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Valid Until</p>
                                    <p className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        {format(new Date(quotation.valid_until), 'MMM d, yyyy')}
                                    </p>
                                </div>
                            )}
                            {quotation.notes && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Notes</p>
                                    <p className="text-sm">{quotation.notes}</p>
                                </div>
                            )}
                            {quotation.documents && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Documents</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {Array.isArray(quotation.documents) ? (
                                            quotation.documents.map((doc: string, idx: number) => (
                                                <a
                                                    key={idx}
                                                    href={doc}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-600 hover:underline"
                                                >
                                                    Document {idx + 1}
                                                </a>
                                            ))
                                        ) : (
                                            <a
                                                href={quotation.documents}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-blue-600 hover:underline"
                                            >
                                                View Document
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Vendor Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Vendor Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {quotation.vendor ? (
                                <>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Business Name</p>
                                        <p className="font-semibold">{quotation.vendor.business_name}</p>
                                    </div>
                                    {quotation.vendor.owner_name && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Owner</p>
                                            <p className="flex items-center gap-2">
                                                <User className="h-4 w-4" />
                                                {quotation.vendor.owner_name}
                                            </p>
                                        </div>
                                    )}
                                    {quotation.vendor.email && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Email</p>
                                            <p className="flex items-center gap-2">
                                                <Mail className="h-4 w-4" />
                                                {quotation.vendor.email}
                                            </p>
                                        </div>
                                    )}
                                    {quotation.vendor.phone && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Phone</p>
                                            <p className="flex items-center gap-2">
                                                <Phone className="h-4 w-4" />
                                                {quotation.vendor.phone}
                                            </p>
                                        </div>
                                    )}
                                    {quotation.vendor.city && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Location</p>
                                            <p className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4" />
                                                {quotation.vendor.city}
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-muted-foreground">Vendor information not available</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Booking Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Booking Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {quotation.booking ? (
                                <>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Booking ID</p>
                                        <p className="font-mono text-sm">{quotation.booking.id}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Customer Name</p>
                                        <p className="font-semibold">{quotation.booking.customer_name}</p>
                                    </div>
                                    {quotation.booking.customer_email && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Customer Email</p>
                                            <p className="flex items-center gap-2">
                                                <Mail className="h-4 w-4" />
                                                {quotation.booking.customer_email}
                                            </p>
                                        </div>
                                    )}
                                    {quotation.booking.customer_phone && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Customer Phone</p>
                                            <p className="flex items-center gap-2">
                                                <Phone className="h-4 w-4" />
                                                {quotation.booking.customer_phone}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm text-muted-foreground">Booking Date</p>
                                        <p className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            {format(new Date(quotation.booking.booking_date), 'MMM d, yyyy')}
                                        </p>
                                    </div>
                                    {quotation.booking.city && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Location</p>
                                            <p className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4" />
                                                {quotation.booking.city}
                                            </p>
                                        </div>
                                    )}
                                    {quotation.booking.details && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Event Details</p>
                                            <p className="text-sm">{quotation.booking.details}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-muted-foreground">Booking information not available</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                            <CardDescription>Accept or reject this quotation proposal</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {quotation.status !== 'accepted' && (
                                <Button
                                    onClick={() => handleStatusUpdate('accepted')}
                                    disabled={processing}
                                    className="w-full bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Accept Proposal
                                </Button>
                            )}
                            {quotation.status !== 'rejected' && (
                                <Button
                                    onClick={() => handleStatusUpdate('rejected')}
                                    disabled={processing}
                                    variant="destructive"
                                    className="w-full"
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject Proposal
                                </Button>
                            )}
                            {quotation.status === 'accepted' && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                                    <p className="text-sm text-green-800 dark:text-green-200">
                                        This quotation has been accepted.
                                    </p>
                                </div>
                            )}
                            {quotation.status === 'rejected' && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                                    <p className="text-sm text-red-800 dark:text-red-200">
                                        This quotation has been rejected.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DefaultLayout>
    )
}

