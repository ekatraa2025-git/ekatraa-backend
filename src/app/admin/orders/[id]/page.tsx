'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, MapPin, X } from 'lucide-react'
import { toast } from 'sonner'

type OrderItem = {
    id: string
    name: string
    quantity: number
    unit_price: number
    service_id?: string | null
    allocated_vendor_id?: string | null
    allocated_vendor_name?: string | null
    allocated_vendor_city?: string | null
}

type EligibleRow = {
    id: string
    business_name: string
    city?: string | null
    match: 'catalog_id' | 'name'
}

export default function OrderDetailPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [order, setOrder] = useState<{
        id: string
        status: string
        total_amount?: number
        advance_amount?: number
        advance_paid_at?: string
        razorpay_payment_id?: string
        razorpay_order_id?: string
        contact_name?: string
        contact_mobile?: string
        contact_email?: string
        event_name?: string
        event_date?: string
        items?: OrderItem[]
        status_history?: { status: string; note?: string; created_at: string }[]
    } | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [newStatus, setNewStatus] = useState('')
    const [vendors, setVendors] = useState<{ id: string; business_name: string; city?: string }[]>([])
    const [eligibleByItem, setEligibleByItem] = useState<Record<string, EligibleRow[]>>({})
    const [overrideAllocate, setOverrideAllocate] = useState<Record<string, boolean>>({})
    const [allocatingItemId, setAllocatingItemId] = useState<string | null>(null)
    const [selectedVendorByItem, setSelectedVendorByItem] = useState<Record<string, string>>({})

    const loadOrder = () => {
        fetch(`/api/admin/orders/${id}`)
            .then((r) => r.json())
            .then(async (data) => {
                if (data?.error) {
                    toast.error(data.error)
                    router.push('/admin/orders')
                } else {
                    setOrder(data)
                    setNewStatus(data?.status ?? '')
                    const items = data?.items as OrderItem[] | undefined
                    if (items?.length) {
                        const elig: Record<string, EligibleRow[]> = {}
                        await Promise.all(
                            items.map(async (it) => {
                                const r = await fetch(
                                    `/api/admin/orders/${id}/eligible-vendors?order_item_id=${encodeURIComponent(it.id)}`
                                )
                                const j = await r.json()
                                if (j.eligible && Array.isArray(j.eligible)) {
                                    elig[it.id] = j.eligible as EligibleRow[]
                                }
                            })
                        )
                        setEligibleByItem(elig)
                    }
                }
                setLoading(false)
            })
    }

    useEffect(() => {
        loadOrder()
        fetch('/api/admin/vendors?status=active')
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setVendors(data)
            })
    }, [id, router])

    const handleAllocateItem = async (orderItemId: string) => {
        const vendorId = selectedVendorByItem[orderItemId]
        if (!vendorId) {
            toast.error('Select a vendor')
            return
        }
        setAllocatingItemId(orderItemId)
        const res = await fetch(`/api/admin/orders/${id}/allocate-item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_item_id: orderItemId,
                vendor_id: vendorId,
                override: overrideAllocate[orderItemId] === true,
            }),
        })
        const data = await res.json()
        setAllocatingItemId(null)
        if (data?.error) toast.error(data.error)
        else {
            toast.success('Item allocated')
            loadOrder()
        }
    }

    const handleDeallocateItem = async (orderItemId: string) => {
        setAllocatingItemId(orderItemId)
        const res = await fetch(`/api/admin/orders/${id}/allocate-item?order_item_id=${orderItemId}`, { method: 'DELETE' })
        const data = await res.json()
        setAllocatingItemId(null)
        if (data?.error) toast.error(data.error)
        else {
            toast.success('Allocation removed')
            loadOrder()
        }
    }

    const handleStatusUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newStatus) return
        setSaving(true)
        const res = await fetch(`/api/admin/orders/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        })
        const data = await res.json()
        setSaving(false)
        if (data?.error) toast.error(data.error)
        else {
            setOrder((prev) => (prev ? { ...prev, status: newStatus } : null))
        }
    }

    if (loading || !order) {
        return (
            <DefaultLayout>
                <div className="flex h-60 items-center justify-center">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
            </DefaultLayout>
        )
    }

    return (
        <DefaultLayout>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Order {order.id?.slice(0, 8)}…</CardTitle>
                        <Badge variant="outline" className="capitalize w-fit">
                            {order.status}
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Contact</p>
                            <p>{order.contact_name} {order.contact_mobile && ` · ${order.contact_mobile}`}</p>
                            {order.contact_email && <p className="text-sm">{order.contact_email}</p>}
                        </div>
                        {order.event_name && (
                            <div>
                                <p className="text-sm text-muted-foreground">Event</p>
                                <p>{order.event_name} {order.event_date && ` · ${order.event_date}`}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-sm text-muted-foreground">Total</p>
                            <p className="text-lg font-semibold">₹{Number(order.total_amount ?? 0).toLocaleString()}</p>
                        </div>
                        {order.advance_amount != null && Number(order.advance_amount) > 0 && (
                            <div className="pt-4 border-t space-y-2">
                                <p className="text-sm font-medium">Advance Payment</p>
                                <p className="text-lg font-semibold text-green-600">₹{Number(order.advance_amount).toLocaleString()} paid</p>
                                {order.advance_paid_at && (
                                    <p className="text-xs text-muted-foreground">Paid at {new Date(order.advance_paid_at).toLocaleString()}</p>
                                )}
                                {order.razorpay_payment_id && (
                                    <p className="text-xs font-mono text-muted-foreground">Payment ID: {order.razorpay_payment_id}</p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {order.items && order.items.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Items
                                <span className="text-sm font-normal text-muted-foreground">— allocate services to vendors by location</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-4">
                                {order.items.map((item) => (
                                    <li key={item.id} className="flex flex-col gap-2 rounded-lg border p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="font-medium">{item.name} × {item.quantity}</span>
                                                <span className="ml-2">₹{Number(item.unit_price * item.quantity).toLocaleString()}</span>
                                            </div>
                                            {item.allocated_vendor_id ? (
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {item.allocated_vendor_name || 'Vendor'}
                                                        {item.allocated_vendor_city && ` (${item.allocated_vendor_city})`}
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-destructive"
                                                        onClick={() => handleDeallocateItem(item.id)}
                                                        disabled={!!allocatingItemId}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                                                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <input
                                                            type="checkbox"
                                                            checked={overrideAllocate[item.id] === true}
                                                            onChange={(e) =>
                                                                setOverrideAllocate((p) => ({
                                                                    ...p,
                                                                    [item.id]: e.target.checked,
                                                                }))
                                                            }
                                                        />
                                                        Show all vendors (override)
                                                    </label>
                                                    <select
                                                        className="rounded-md border px-3 py-1.5 text-sm min-w-[200px]"
                                                        value={selectedVendorByItem[item.id] ?? ''}
                                                        onChange={(e) => setSelectedVendorByItem((p) => ({ ...p, [item.id]: e.target.value }))}
                                                    >
                                                        <option value="">
                                                            {overrideAllocate[item.id]
                                                                ? 'Select any vendor'
                                                                : 'Select matching vendor (category + portfolio)'}
                                                        </option>
                                                        {!overrideAllocate[item.id] &&
                                                            (eligibleByItem[item.id] ?? []).map((v) => (
                                                                <option key={v.id} value={v.id}>
                                                                    {v.business_name}
                                                                    {v.city ? ` — ${v.city}` : ''} ({v.match})
                                                                </option>
                                                            ))}
                                                        {overrideAllocate[item.id] &&
                                                            vendors.map((v) => (
                                                                <option key={v.id} value={v.id}>
                                                                    {v.business_name} {v.city ? `— ${v.city}` : ''}
                                                                </option>
                                                            ))}
                                                    </select>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleAllocateItem(item.id)}
                                                        disabled={!selectedVendorByItem[item.id] || allocatingItemId === item.id}
                                                    >
                                                        {allocatingItemId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Allocate'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Update status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleStatusUpdate} className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-sm font-medium">Status</label>
                                <select
                                    className="mt-1 w-full rounded-md border px-3 py-2"
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value)}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="in_progress">In progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {order.status_history && order.status_history.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Status history</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-1 text-sm">
                                {order.status_history.map((h, i) => (
                                    <li key={i}>
                                        <span className="font-medium">{h.status}</span>
                                        {h.note && ` — ${h.note}`}
                                        <span className="text-muted-foreground ml-2">
                                            {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}
            </div>
        </DefaultLayout>
    )
}
