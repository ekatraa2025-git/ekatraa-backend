'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function EditOccasionPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ name: '', icon: '', display_order: 0, is_active: true })

    useEffect(() => {
        fetch(`/api/admin/occasions/${id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data && !data.error) setForm({
                    name: data.name ?? '',
                    icon: data.icon ?? '',
                    display_order: data.display_order ?? 0,
                    is_active: data.is_active !== false,
                })
            })
    }, [id])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await fetch(`/api/admin/occasions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const data = await res.json()
        setLoading(false)
        if (data.error) toast.error(data.error)
        else router.push('/admin/occasions')
    }

    return (
        <DefaultLayout>
            <Card>
                <CardHeader>
                    <CardTitle>Edit Occasion: {id}</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Icon</label>
                            <Input
                                value={form.icon}
                                onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Display order</label>
                            <Input
                                type="number"
                                value={form.display_order}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, display_order: Number(e.target.value) || 0 }))
                                }
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={form.is_active}
                                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                            />
                            <label htmlFor="is_active" className="text-sm font-medium">Active</label>
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </DefaultLayout>
    )
}
