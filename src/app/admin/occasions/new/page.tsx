'use client'

import React, { useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function NewOccasionPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({ id: '', name: '', icon: '', display_order: 0 })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await fetch('/api/admin/occasions', {
            method: 'POST',
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
                    <CardTitle>Add Occasion</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">ID (slug)</label>
                            <Input
                                value={form.id}
                                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                                placeholder="e.g. wedding"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="Wedding"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Icon (emoji)</label>
                            <Input
                                value={form.icon}
                                onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
                                placeholder="💒"
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
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </DefaultLayout>
    )
}
