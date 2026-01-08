'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft, CheckCircle, XCircle, Calendar, User, MapPin, Phone, Mail, FileText, Building2, DollarSign, Package, Truck, CreditCard, ClipboardList, Image as ImageIcon, ExternalLink, Clock } from 'lucide-react'
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

    // Helper to render attachments
    const renderAttachments = (attachments: any) => {
        if (!attachments) return null
        
        const allAttachments: { category: string; urls: string[] }[] = []
        
        if (typeof attachments === 'object') {
            Object.entries(attachments).forEach(([category, urls]) => {
                if (Array.isArray(urls) && urls.length > 0) {
                    allAttachments.push({ category, urls: urls as string[] })
                }
            })
        }
        
        if (allAttachments.length === 0) return null

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        Uploaded Documents & Attachments
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {allAttachments.map(({ category, urls }) => (
                        <div key={category}>
                            <p className="text-sm font-medium text-muted-foreground mb-2 capitalize">
                                {category.replace(/_/g, ' ')}
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {urls.map((url, idx) => {
                                    // URLs are now signed URLs from the API, use directly
                                    const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('image') || url.includes('storage')
                                    
                                    return (
                                        <a
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group relative"
                                        >
                                            {isImage ? (
                                                <div className="w-24 h-24 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors">
                                                    <img 
                                                        src={url} 
                                                        alt={`${category} ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = '/placeholder.png'
                                                        }}
                                                    />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <ExternalLink className="h-5 w-5 text-white" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                                                    <FileText className="h-4 w-4" />
                                                    <span className="text-sm">Document {idx + 1}</span>
                                                    <ExternalLink className="h-3 w-3" />
                                                </div>
                                            )}
                                        </a>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        )
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
                            {(quotation.service?.name || quotation.service_type) && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Service</p>
                                    <p className="font-semibold">{quotation.service?.name || quotation.service_type}</p>
                                    {quotation.service?.category && (
                                        <p className="text-xs text-muted-foreground">{quotation.service.category}</p>
                                    )}
                                </div>
                            )}
                            {(quotation.customer_name || quotation.booking?.customer_name) && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Customer Name</p>
                                    <p className="font-semibold">{quotation.customer_name || quotation.booking?.customer_name}</p>
                                </div>
                            )}
                            {quotation.quotation_date && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Quotation Date</p>
                                    <p className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        {format(new Date(quotation.quotation_date), 'MMM d, yyyy')}
                                    </p>
                                </div>
                            )}
                            {quotation.delivery_date && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Delivery Date</p>
                                    <p className="flex items-center gap-2">
                                        <Truck className="h-4 w-4" />
                                        {format(new Date(quotation.delivery_date), 'MMM d, yyyy')}
                                    </p>
                                </div>
                            )}
                            {quotation.valid_until && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Valid Until</p>
                                    <p className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        {format(new Date(quotation.valid_until), 'MMM d, yyyy')}
                                    </p>
                                </div>
                            )}
                            {(quotation.venue_address || quotation.booking?.venue) && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Venue Address</p>
                                    <p className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        {quotation.venue_address || quotation.booking?.venue}
                                    </p>
                                </div>
                            )}
                            {quotation.booking_id && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Linked Booking</p>
                                    <p className="font-mono text-sm text-primary">{quotation.booking_id.slice(0, 8)}...</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pricing Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5" />
                                Pricing Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-primary/10 rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                                <p className="text-3xl font-bold text-primary">₹{quotation.total_amount || quotation.amount || 0}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Vendor T&C</p>
                                    <Badge variant={quotation.vendor_tc_accepted ? 'secondary' : 'outline'}>
                                        {quotation.vendor_tc_accepted ? 'Accepted' : 'Pending'}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Customer T&C</p>
                                    <Badge variant={quotation.customer_tc_accepted ? 'secondary' : 'outline'}>
                                        {quotation.customer_tc_accepted ? 'Accepted' : 'Pending'}
                                    </Badge>
                                </div>
                            </div>
                            {quotation.created_at && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Created At</p>
                                    <p className="text-sm">{format(new Date(quotation.created_at), 'MMM d, yyyy HH:mm')}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Service Details */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ClipboardList className="h-5 w-5" />
                                Service Requirements & Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-6 md:grid-cols-2">
                                {quotation.specifications && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Specifications</p>
                                        <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{quotation.specifications}</p>
                                    </div>
                                )}
                                {quotation.quantity_requirements && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Quantity Requirements</p>
                                        <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{quotation.quantity_requirements}</p>
                                    </div>
                                )}
                                {quotation.quality_standards && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Quality Standards</p>
                                        <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{quotation.quality_standards}</p>
                                    </div>
                                )}
                                {quotation.delivery_terms && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Delivery Terms</p>
                                        <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{quotation.delivery_terms}</p>
                                    </div>
                                )}
                                {quotation.payment_terms && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Payment Terms</p>
                                        <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{quotation.payment_terms}</p>
                                    </div>
                                )}
                                {quotation.notes && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                                        <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{quotation.notes}</p>
                                    </div>
                                )}
                                {!quotation.specifications && !quotation.quantity_requirements && !quotation.quality_standards && !quotation.delivery_terms && !quotation.payment_terms && !quotation.notes && (
                                    <p className="text-muted-foreground col-span-2 text-center py-4">No service details provided</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Attachments */}
                    {renderAttachments(quotation.attachments)}

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
                                Linked Booking Information
                            </CardTitle>
                            <CardDescription>
                                {(quotation.booking || quotation.booking_id) ? 'Booking details for which this quotation was created' : 'No booking linked'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {(quotation.booking || quotation.booking_id) ? (
                                <>
                                    <div className="p-3 bg-muted/50 rounded-lg border">
                                        <p className="text-xs text-muted-foreground mb-1">Booking ID</p>
                                        <Link 
                                            href={`/admin/bookings/${quotation.booking?.id || quotation.booking_id}`}
                                            className="font-mono text-sm font-semibold text-primary hover:underline"
                                        >
                                            {quotation.booking?.id || quotation.booking_id}
                                        </Link>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => router.push(`/admin/bookings/${quotation.booking?.id || quotation.booking_id}`)}
                                        className="w-full"
                                    >
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        View Full Booking Details
                                    </Button>
                                    {quotation.booking && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Customer Name</p>
                                                    <p className="font-semibold">{quotation.booking.customer_name || quotation.customer_name || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Booking Status</p>
                                                    <Badge variant={quotation.booking.status === 'confirmed' ? 'secondary' : 'outline'}>
                                                        {quotation.booking.status || 'Pending'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            {quotation.booking.customer_email && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Customer Email</p>
                                                    <p className="flex items-center gap-2">
                                                        <Mail className="h-4 w-4" />
                                                        <a href={`mailto:${quotation.booking.customer_email}`} className="text-primary hover:underline">
                                                            {quotation.booking.customer_email}
                                                        </a>
                                                    </p>
                                                </div>
                                            )}
                                            {quotation.booking.customer_phone && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Customer Phone</p>
                                                    <p className="flex items-center gap-2">
                                                        <Phone className="h-4 w-4" />
                                                        <a href={`tel:${quotation.booking.customer_phone}`} className="text-primary hover:underline">
                                                            {quotation.booking.customer_phone}
                                                        </a>
                                                    </p>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-4">
                                                {quotation.booking.booking_date && (
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Event Date</p>
                                                        <p className="flex items-center gap-2 font-medium">
                                                            <Calendar className="h-4 w-4" />
                                                            {format(new Date(quotation.booking.booking_date), 'MMM d, yyyy')}
                                                        </p>
                                                    </div>
                                                )}
                                                {quotation.booking.booking_time && (
                                                    <div>
                                                        <p className="text-sm text-muted-foreground">Event Time</p>
                                                        <p className="flex items-center gap-2 font-medium">
                                                            <Clock className="h-4 w-4" />
                                                            {quotation.booking.booking_time}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            {(quotation.booking.venue || quotation.booking.city) && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Venue / Location</p>
                                                    <p className="flex items-center gap-2">
                                                        <MapPin className="h-4 w-4" />
                                                        {quotation.booking.venue || quotation.booking.city}
                                                    </p>
                                                </div>
                                            )}
                                            {quotation.booking.details && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground mb-2">Event Details / Requirements</p>
                                                    <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{quotation.booking.details}</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {!quotation.booking && quotation.booking_id && (
                                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                                Booking details could not be loaded. Click the button above to view the booking.
                                            </p>
                                        </div>
                                    )}
                                    {quotation.service && (
                                        <div className="pt-2 border-t">
                                            <p className="text-sm text-muted-foreground mb-2">Service Requested</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                                    <Package className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{quotation.service.name}</p>
                                                    {quotation.service.category && (
                                                        <p className="text-xs text-muted-foreground">{quotation.service.category}</p>
                                                    )}
                                                    {quotation.service.base_price && (
                                                        <p className="text-xs text-primary">Base Price: ₹{quotation.service.base_price}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-6 text-muted-foreground">
                                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                    <p>No booking linked to this quotation</p>
                                    <p className="text-xs mt-1">This quotation may have been created independently</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                            <CardDescription>Accept or reject this quotation proposal</CardDescription>
                        </CardHeader>
                        <CardContent className="flex gap-3 flex-wrap">
                            {quotation.status !== 'accepted' && (
                                <Button
                                    onClick={() => handleStatusUpdate('accepted')}
                                    disabled={processing}
                                    className="bg-green-600 hover:bg-green-700"
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
                                >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject Proposal
                                </Button>
                            )}
                            {quotation.status === 'accepted' && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md flex-1">
                                    <p className="text-sm text-green-800 dark:text-green-200">
                                        ✓ This quotation has been accepted.
                                    </p>
                                </div>
                            )}
                            {quotation.status === 'rejected' && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md flex-1">
                                    <p className="text-sm text-red-800 dark:text-red-200">
                                        ✗ This quotation has been rejected.
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

