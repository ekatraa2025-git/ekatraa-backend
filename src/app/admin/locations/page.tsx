'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { MapPin, Check, Search, Calendar as CalendarIcon, User, Info } from 'lucide-react'
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

export default function BookingAllocationPage() {
    const [bookings, setBookings] = useState<any[]>([])
    const [vendors, setVendors] = useState<any[]>([])
    const [selectedBooking, setSelectedBooking] = useState<any>(null)
    const [showAllVendors, setShowAllVendors] = useState(false)
    const [selectedCity, setSelectedCity] = useState<string>('')

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            // Fetch ALL bookings (both allocated and unallocated) for allocation management
            const bookingsRes = await fetch('/api/admin/bookings', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                cache: 'no-store'
            })
            
            const vendorsRes = await fetch('/api/admin/vendors?status=active', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                cache: 'no-store'
            })

            if (!bookingsRes.ok) {
                throw new Error(`Bookings API error: ${bookingsRes.status}`)
            }
            
            if (!vendorsRes.ok) {
                throw new Error(`Vendors API error: ${vendorsRes.status}`)
            }

            const bData = await bookingsRes.json()
            const vData = await vendorsRes.json()

            // Handle API errors
            if (bData?.error) {
                console.error('Bookings API Error:', bData.error)
                setBookings([])
            } else {
                // Show all bookings - both allocated and unallocated for management
                // The API already includes vendor_name for allocated bookings
                const bookingsArray = Array.isArray(bData) ? bData : []
                setBookings(bookingsArray)
            }

            if (vData?.error) {
                console.error('Vendors API Error:', vData.error)
                setVendors([])
            } else {
                const vendorsArray = Array.isArray(vData) ? vData : []
                setVendors(vendorsArray)
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            setBookings([])
            setVendors([])
        }
    }

    const handleAllocate = async (vendorId: string) => {
        if (!selectedBooking || !vendorId) return

        try {
            const res = await fetch(`/api/admin/bookings/${selectedBooking.id}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ vendor_id: vendorId, status: 'confirmed' })
            })

            if (!res.ok) {
                throw new Error(`Failed to allocate booking: ${res.status}`)
            }

            const result = await res.json()

            if (result.error) {
                alert(result.error)
            } else {
                // Successfully allocated - booking is now assigned to the selected vendor
                alert(`Booking allocated to vendor successfully!`)
                setSelectedBooking(null)
                setShowAllVendors(false)
                fetchData()
            }
        } catch (error: any) {
            console.error('Error allocating booking:', error)
            alert(`Failed to allocate booking: ${error.message}`)
        }
    }

    const getSuggestedVendors = () => {
        if (!selectedBooking) return []

        let filteredVendors = vendors

        // Apply city filter if selected
        if (selectedCity) {
            filteredVendors = filteredVendors.filter(v =>
                v.city?.toLowerCase() === selectedCity.toLowerCase() ||
                v.service_area?.toLowerCase() === selectedCity.toLowerCase()
            )
        }

        const bookingCity = selectedBooking.city?.toLowerCase() || ''
        const matchingVendors = filteredVendors.filter(v =>
            v.city?.toLowerCase().includes(bookingCity) ||
            v.service_area?.toLowerCase().includes(bookingCity)
        )

        // If showAllVendors is true or no matches, show all filtered vendors
        if (showAllVendors || matchingVendors.length === 0) {
            return filteredVendors
        }

        return matchingVendors
    }

    // Get unique cities from vendors for filter
    const getUniqueCities = () => {
        const cities = new Set<string>()
        vendors.forEach(v => {
            if (v.city) cities.add(v.city)
            if (v.service_area) cities.add(v.service_area)
        })
        return Array.from(cities).sort()
    }

    // Reset showAllVendors and city filter when booking selection changes
    useEffect(() => {
        setShowAllVendors(false)
        setSelectedCity('')
    }, [selectedBooking])

    return (
        <DefaultLayout>
            <div className="flex flex-col gap-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Booking Allocation</h2>
                    <p className="text-muted-foreground">Match unallocated bookings with service providers based on location.</p>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {/* Bookings List */}
                    <Card className="flex flex-col h-[600px]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarIcon className="h-5 w-5 text-primary" />
                                Bookings
                            </CardTitle>
                            <CardDescription>
                                {bookings.filter((b: any) => !b.vendor_id).length} unallocated, {bookings.filter((b: any) => b.vendor_id).length} allocated
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                            <ScrollArea className="h-full pr-4">
                                <div className="space-y-3">
                                    {bookings.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                            <Check className="h-10 w-10 mb-2 opacity-20" />
                                            <p>No bookings found.</p>
                                        </div>
                                    ) : (
                                        bookings.map((booking) => {
                                            const isAllocated = booking.vendor_id && booking.vendor_id !== null && booking.vendor_id !== ''
                                            return (
                                                <div
                                                    key={booking.id}
                                                    onClick={() => setSelectedBooking(booking)}
                                                    className={`group cursor-pointer rounded-lg border p-4 transition-all hover:shadow-sm ${selectedBooking?.id === booking.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="space-y-1">
                                                            <p className="font-semibold leading-none">{booking.customer_name}</p>
                                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                                <span className="flex items-center gap-1">
                                                                    <MapPin className="h-3 w-3" /> {booking.city || 'TBD'}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <CalendarIcon className="h-3 w-3" /> {format(new Date(booking.booking_date), 'MMM d, yyyy')}
                                                                </span>
                                                            </div>
                                                            {isAllocated && booking.vendor_name && (
                                                                <p className="text-xs text-muted-foreground">Vendor: {booking.vendor_name}</p>
                                                            )}
                                                        </div>
                                                        <Badge variant={isAllocated ? 'secondary' : 'outline'}>
                                                            {isAllocated ? 'Allocated' : 'Unallocated'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Vendor Matching Section */}
                    <Card className="flex flex-col h-[600px]">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <CardTitle className="flex items-center gap-2">
                                        <User className="h-5 w-5 text-primary" />
                                        Suggested Vendors
                                    </CardTitle>
                                    <CardDescription>
                                        {selectedBooking ? (
                                            selectedBooking.vendor_id ? 
                                                `Change allocation for ${selectedBooking.customer_name}. Current vendor: ${selectedBooking.vendor_name || 'Unknown'}` :
                                                `Matching partners for ${selectedBooking.city || 'this location'}`
                                        ) : 'Select a booking to allocate or change vendor'}
                                    </CardDescription>
                                </div>
                            </div>
                            {selectedBooking && (
                                <div className="mt-4">
                                    <label className="text-sm font-medium text-muted-foreground mb-2 block">Filter by City</label>
                                    <select
                                        value={selectedCity}
                                        onChange={(e) => setSelectedCity(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="">All Cities</option>
                                        {getUniqueCities().map((city) => (
                                            <option key={city} value={city}>
                                                {city}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                            {!selectedBooking ? (
                                <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                                    <Search className="mb-4 h-12 w-12 opacity-10" />
                                    <p>Select a booking from the left to begin allocation</p>
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
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => setShowAllVendors(true)}
                                                            className="w-full"
                                                        >
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
                                                            variant={selectedBooking?.vendor_id === vendor.id ? 'secondary' : 'default'}
                                                        >
                                                            <Check className="mr-1 h-3 w-3" />
                                                            {selectedBooking?.vendor_id === vendor.id ? 'Current' : 'Allocate'}
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

