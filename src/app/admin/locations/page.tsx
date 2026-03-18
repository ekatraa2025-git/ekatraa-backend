'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { MapPin, Check, Search, Calendar as CalendarIcon, User, Info, ListChecks } from 'lucide-react'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export default function OrderAllocationPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [vendors, setVendors] = useState<any[]>([])
    const [selectedOrder, setSelectedOrder] = useState<any>(null)
    const [showAllVendors, setShowAllVendors] = useState(false)
    const [selectedCity, setSelectedCity] = useState<string>('')

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const ordersRes = await fetch('/api/admin/orders', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store'
            })
            const vendorsRes = await fetch('/api/admin/vendors?status=active', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store'
            })

            if (!ordersRes.ok) throw new Error(`Orders API error: ${ordersRes.status}`)
            if (!vendorsRes.ok) throw new Error(`Vendors API error: ${vendorsRes.status}`)

            const oData = await ordersRes.json()
            const vData = await vendorsRes.json()

            if (oData?.error) {
                console.error('Orders API Error:', oData.error)
                setOrders([])
            } else {
                setOrders(Array.isArray(oData) ? oData : [])
            }
            if (vData?.error) {
                console.error('Vendors API Error:', vData.error)
                setVendors([])
            } else {
                setVendors(Array.isArray(vData) ? vData : [])
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            setOrders([])
            setVendors([])
        }
    }

    const handleAllocate = async (vendorId: string) => {
        if (!selectedOrder || !vendorId) return
        try {
            const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendor_id: vendorId, status: 'confirmed' })
            })
            if (!res.ok) throw new Error(`Failed to allocate order: ${res.status}`)
            const result = await res.json()
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Order allocated to vendor successfully!')
                setSelectedOrder(null)
                setShowAllVendors(false)
                fetchData()
            }
        } catch (error: any) {
            console.error('Error allocating order:', error)
            toast.error(`Failed to allocate order: ${error.message}`)
        }
    }

    const getSuggestedVendors = () => {
        if (!selectedOrder) return []
        let filteredVendors = vendors
        if (selectedCity) {
            filteredVendors = filteredVendors.filter(v =>
                v.city?.toLowerCase() === selectedCity.toLowerCase() ||
                v.service_area?.toLowerCase() === selectedCity.toLowerCase()
            )
        }
        const orderLocation = (selectedOrder.location_preference || selectedOrder.venue_preference || '').toLowerCase()
        const matchingVendors = filteredVendors.filter(v =>
            v.city?.toLowerCase().includes(orderLocation) ||
            v.service_area?.toLowerCase().includes(orderLocation)
        )
        if (showAllVendors || matchingVendors.length === 0) return filteredVendors
        return matchingVendors
    }

    const getUniqueCities = () => {
        const cities = new Set<string>()
        vendors.forEach(v => {
            if (v.city) cities.add(v.city)
            if (v.service_area) cities.add(v.service_area)
        })
        return Array.from(cities).sort()
    }

    useEffect(() => {
        setShowAllVendors(false)
        setSelectedCity('')
    }, [selectedOrder])

    return (
        <DefaultLayout>
            <div className="flex flex-col gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Order Allocation</h2>
                    <p className="text-muted-foreground">Match unallocated orders with service providers based on location.</p>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <Card className="flex flex-col h-[600px]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                                Orders
                            </CardTitle>
                            <CardDescription>
                                {orders.filter((o: any) => !o.vendor_id && (o.allocation_count ?? 0) === 0).length} unallocated, {orders.filter((o: any) => o.vendor_id || (o.allocation_count ?? 0) > 0).length} allocated
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full pr-4">
                                <div className="space-y-3">
                                    {orders.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                            <Check className="h-10 w-10 mb-2 opacity-20" />
                                            <p>No orders found.</p>
                                        </div>
                                    ) : (
                                        orders.map((order) => {
                                            const isAllocated = (order.vendor_id && order.vendor_id !== null && order.vendor_id !== '') || (order.allocation_count ?? 0) > 0
                                            return (
                                                <div
                                                    key={order.id}
                                                    onClick={() => setSelectedOrder(order)}
                                                    className={`group cursor-pointer rounded-lg border p-4 transition-all hover:shadow-sm ${selectedOrder?.id === order.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="space-y-1">
                                                            <p className="font-semibold leading-none">{order.contact_name || order.event_name || 'Order'}</p>
                                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <MapPin className="h-3 w-3" /> {order.location_preference || order.venue_preference || 'TBD'}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <CalendarIcon className="h-3 w-3" /> {order.event_date ? format(new Date(order.event_date), 'MMM d, yyyy') : 'TBD'}
                                                                </span>
                                                            </div>
                                                            {isAllocated && order.vendor_name && (
                                                                <p className="text-xs text-muted-foreground">Vendor: {order.vendor_name}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Link
                                                                href={`/admin/orders/${order.id}`}
                                                                className="text-xs text-primary hover:underline flex items-center gap-1"
                                                            >
                                                                <ListChecks className="h-3 w-3" />
                                                                Allocate by service
                                                            </Link>
                                                            <Badge variant={isAllocated ? 'secondary' : 'outline'}>
                                                                {isAllocated ? 'Allocated' : 'Unallocated'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    <Card className="flex flex-col h-[600px]">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="h-5 w-5 text-primary" />
                                        Suggested Vendors
                                    </CardTitle>
                                    <CardDescription>
                                        {selectedOrder ? (
                                            selectedOrder.vendor_id
                                                ? `Change allocation for ${selectedOrder.contact_name || 'this order'}. Current vendor: ${selectedOrder.vendor_name || 'Unknown'}`
                                                : `Matching partners for ${selectedOrder.location_preference || selectedOrder.venue_preference || 'this location'}`
                                        ) : 'Select an order to allocate or change vendor'}
                                    </CardDescription>
                                </div>
                            </div>
                            {selectedOrder && (
                                <div className="mt-4">
                                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Filter by City</label>
                                    <select
                                        value={selectedCity}
                                        onChange={(e) => setSelectedCity(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="">All Cities</option>
                                        {getUniqueCities().map((city) => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                            {!selectedOrder ? (
                                <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                                    <Search className="mb-4 h-12 w-12 opacity-10" />
                                    <p>Select an order from the left to begin allocation</p>
                                </div>
                            ) : (
                                <ScrollArea className="h-full pr-4">
                                    <div className="space-y-4">
                                        {getSuggestedVendors().length === 0 ? (
                                            <div className="p-8 border-2 border-dashed rounded-lg text-center space-y-2">
                                                <Info className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                                                <p className="text-sm font-medium text-muted-foreground">No active vendors available.</p>
                                            </div>
                                        ) : (
                                            <>
                                                {!showAllVendors && getSuggestedVendors().length < vendors.length && (
                                                    <div className="mb-4">
                                                        <Button variant="outline" size="sm" onClick={() => setShowAllVendors(true)} className="w-full">
                                                            View All Active Vendors ({vendors.length})
                                                        </Button>
                                                    </div>
                                                )}
                                                {getSuggestedVendors().map((vendor) => (
                                                    <div key={vendor.id} className="flex items-center justify-between rounded-lg border p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
                                                        <div className="space-y-1 flex-1">
                                                            <p className="font-bold">{vendor.business_name}</p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <MapPin className="h-3 w-3" /> {vendor.city || vendor.service_area || 'Location not specified'}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleAllocate(vendor.id)}
                                                            className="h-8 ml-4"
                                                            variant={selectedOrder?.vendor_id === vendor.id ? 'secondary' : 'default'}
                                                        >
                                                            <Check className="mr-1 h-3 w-3" />
                                                            {selectedOrder?.vendor_id === vendor.id ? 'Current' : 'Allocate'}
                                                        </Button>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DefaultLayout>
    )
}
