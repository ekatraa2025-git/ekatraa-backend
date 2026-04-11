'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function EditEInviteFaqPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [fetching, setFetching] = useState(true)
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        question: '',
        answer: '',
        display_order: 0,
        is_active: true,
    })

    useEffect(() => {
        fetch(`/api/admin/e-invites/faqs/${id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data?.error) {
                    toast.error(data.error)
                    router.push('/admin/e-invites')
                    return
                }
                setForm({
                    question: data.question || '',
                    answer: data.answer || '',
                    display_order: Number(data.display_order || 0),
                    is_active: data.is_active !== false,
                })
            })
            .finally(() => setFetching(false))
    }, [id, router])

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.question.trim() || !form.answer.trim()) {
            toast.error('Question and answer are required')
            return
        }
        setLoading(true)
        const res = await fetch(`/api/admin/e-invites/faqs/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const data = await res.json()
        setLoading(false)
        if (data?.error) toast.error(data.error)
        else router.push('/admin/e-invites')
    }

    if (fetching) {
        return (
            <DefaultLayout>
                <div className="flex h-60 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DefaultLayout>
        )
    }

    return (
        <DefaultLayout>
            <Card className="max-w-3xl">
                <CardHeader>
                    <CardTitle>Edit E-Invite FAQ</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Question</label>
                            <Input
                                className="mt-1"
                                value={form.question}
                                onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Answer</label>
                            <textarea
                                className="mt-1 w-full rounded-md border px-3 py-2 min-h-[120px]"
                                value={form.answer}
                                onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Display Order</label>
                            <Input
                                type="number"
                                className="mt-1"
                                value={form.display_order}
                                onChange={(e) =>
                                    setForm((p) => ({ ...p, display_order: Number(e.target.value) || 0 }))
                                }
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                id="faq_active"
                                type="checkbox"
                                checked={form.is_active}
                                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                            />
                            <label htmlFor="faq_active">Active</label>
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save FAQ
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </DefaultLayout>
    )
}
