'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function OrderDetailPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [order, setOrder] = useState<{
        id: string
        status: string
        total_amount?: number
        contact_name?: string
        contact_mobile?: string
        contact_email?: string
        event_name?: string
        event_date?: string
        items?: { name: string; quantity: number; unit_price: number }[]
        status_history?: { status: string; note?: string; created_at: string }[]
    } | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [newStatus, setNewStatus] = useState('')

    useEffect(() => {
        fetch(`/api/admin/orders/${id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data?.error) {
                    toast.error(data.error)
                    router.push('/admin/orders')
                } else {
                    setOrder(data)
                    setNewStatus(data?.status ?? '')
                }
                setLoading(false)
            })
    }, [id, router])

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
                    </CardContent>
                </Card>

                {order.items && order.items.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Items</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2">
                                {order.items.map((item, i) => (
                                    <li key={i} className="flex justify-between">
                                        <span>{item.name} × {item.quantity}</span>
                                        <span>₹{Number(item.unit_price * item.quantity).toLocaleString()}</span>
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
