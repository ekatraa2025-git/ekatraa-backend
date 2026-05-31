'use client'

import React, { useCallback, useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

type OrderItem = {
    id: string
    name?: string | null
    quantity?: number
    unit_price?: number
    allocated_vendor_name?: string | null
    allocated_vendor_city?: string | null
}

type StatusHistoryRow = {
    id?: string
    status?: string
    note?: string | null
    created_at?: string
}

type OrderDetail = {
    id: string
    status?: string
    contact_name?: string | null
    event_name?: string | null
    event_date?: string | null
    total_amount?: number | null
    advance_amount?: number | null
    vendor_id?: string | null
    created_at?: string
    items?: OrderItem[]
    status_history?: StatusHistoryRow[]
}

const STATUS_OPTIONS = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const

export default function AdminOrderDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [nextStatus, setNextStatus] = useState<string>('')

    const loadOrder = useCallback(async () => {
        if (!id) return
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/orders/${id}`)
            const data = await res.json()
            if (!res.ok || data?.error) {
                toast.error(data?.error || 'Order not found')
                router.push('/admin/orders')
                return
            }
            setOrder(data)
            setNextStatus(String(data.status || 'pending'))
        } finally {
            setLoading(false)
        }
    }, [id, router])

    useEffect(() => {
        void loadOrder()
    }, [loadOrder])

    const handleStatusSave = async () => {
        if (!id || !nextStatus) return
        setSaving(true)
        try {
            const res = await fetch(`/api/admin/orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus, note: `Admin updated status to ${nextStatus}` }),
            })
            const data = await res.json()
            if (data?.error) {
                toast.error(data.error)
                return
            }
            toast.success('Order status updated')
            await loadOrder()
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <DefaultLayout>
                <div className="flex h-60 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DefaultLayout>
        )
    }

    if (!order) return null

    return (
        <DefaultLayout>
            <div className="mb-6 flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/admin/orders">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to orders
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold">
                    Order {order.id ? `ORD-${order.id.slice(-8).toUpperCase()}` : id}
                </h1>
                <Badge variant="outline" className="capitalize">
                    {order.status || '—'}
                </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p>
                            <span className="text-muted-foreground">Contact:</span> {order.contact_name || '—'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Event:</span> {order.event_name || '—'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Event date:</span>{' '}
                            {order.event_date ? new Date(order.event_date).toLocaleDateString() : '—'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Total:</span>{' '}
                            {order.total_amount != null ? `₹${Number(order.total_amount).toLocaleString('en-IN')}` : '—'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Advance:</span>{' '}
                            {order.advance_amount != null && order.advance_amount > 0
                                ? `₹${Number(order.advance_amount).toLocaleString('en-IN')}`
                                : '—'}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Created:</span>{' '}
                            {order.created_at ? new Date(order.created_at).toLocaleString() : '—'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Update status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={nextStatus}
                            onChange={(e) => setNextStatus(e.target.value)}
                        >
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                    {s.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                        <Button onClick={handleStatusSave} disabled={saving || nextStatus === order.status}>
                            {saving ? 'Saving…' : 'Save status'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Line items</CardTitle>
                </CardHeader>
                <CardContent>
                    {(order.items ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items.</p>
                    ) : (
                        <ul className="space-y-2 text-sm">
                            {(order.items ?? []).map((item) => (
                                <li key={item.id} className="rounded-md border border-border p-3">
                                    <p className="font-medium">{item.name || 'Item'}</p>
                                    <p className="text-muted-foreground">
                                        Qty {item.quantity ?? 0} · ₹{Number(item.unit_price ?? 0).toLocaleString('en-IN')}
                                    </p>
                                    {item.allocated_vendor_name ? (
                                        <p className="text-muted-foreground">
                                            Vendor: {item.allocated_vendor_name}
                                            {item.allocated_vendor_city ? ` (${item.allocated_vendor_city})` : ''}
                                        </p>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>Status history</CardTitle>
                </CardHeader>
                <CardContent>
                    {(order.status_history ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No history yet.</p>
                    ) : (
                        <ul className="space-y-2 text-sm">
                            {(order.status_history ?? []).map((row, idx) => (
                                <li key={row.id ?? idx} className="border-b border-border pb-2 last:border-0">
                                    <span className="font-medium capitalize">{row.status || '—'}</span>
                                    {row.created_at ? (
                                        <span className="text-muted-foreground"> · {new Date(row.created_at).toLocaleString()}</span>
                                    ) : null}
                                    {row.note ? <p className="text-muted-foreground">{row.note}</p> : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </DefaultLayout>
    )
}
