'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { uploadFile } from '@/utils/storage'
import { AdminImage } from '@/components/Common/AdminImage'
import { toast } from 'sonner'

const SECTION_OPTIONS = [
    { value: 'wedding_cards', label: 'Wedding Cards' },
    { value: 'video_invites', label: 'Video Invites' },
    { value: 'save_the_date', label: 'Save The Date' },
]

export default function NewEInviteTemplatePage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        section_key: 'wedding_cards',
        title: '',
        subtitle: '',
        thumbnail_url: '',
        preview_url: '',
        template_type: 'image',
        duration_seconds: 0,
        price: 0,
        list_price: 0,
        currency: 'INR',
        display_order: 0,
        is_active: true,
    })

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.title.trim()) {
            toast.error('Title is required')
            return
        }
        setLoading(true)
        const res = await fetch('/api/admin/e-invites/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const data = await res.json()
        setLoading(false)
        if (data?.error) toast.error(data.error)
        else router.push('/admin/e-invites')
    }

    return (
        <DefaultLayout>
            <Card className="max-w-3xl">
                <CardHeader>
                    <CardTitle>New E-Invite Template</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Section</label>
                            <select
                                className="mt-1 w-full rounded-md border px-3 py-2 bg-background"
                                value={form.section_key}
                                onChange={(e) => setForm((p) => ({ ...p, section_key: e.target.value }))}
                            >
                                {SECTION_OPTIONS.map((s) => (
                                    <option key={s.value} value={s.value}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Title</label>
                            <Input
                                className="mt-1"
                                value={form.title}
                                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Subtitle</label>
                            <Input
                                className="mt-1"
                                value={form.subtitle}
                                onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Thumbnail</label>
                            <div className="mt-2 flex items-center gap-4">
                                {form.thumbnail_url ? (
                                    <AdminImage
                                        url={form.thumbnail_url}
                                        alt=""
                                        className="h-24 w-20 rounded-md object-cover border"
                                        placeholderClassName="h-24 w-20 rounded-md bg-muted"
                                    />
                                ) : null}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const path = await uploadFile(file, 'e-invites')
                                        if (path) setForm((p) => ({ ...p, thumbnail_url: path }))
                                        else toast.error('Upload failed')
                                    }}
                                    className="text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Preview URL (optional)</label>
                            <Input
                                className="mt-1"
                                value={form.preview_url}
                                onChange={(e) => setForm((p) => ({ ...p, preview_url: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium">Template Type</label>
                                <select
                                    className="mt-1 w-full rounded-md border px-3 py-2 bg-background"
                                    value={form.template_type}
                                    onChange={(e) => setForm((p) => ({ ...p, template_type: e.target.value }))}
                                >
                                    <option value="image">Image</option>
                                    <option value="video">Video</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Duration (sec)</label>
                                <Input
                                    type="number"
                                    className="mt-1"
                                    value={form.duration_seconds}
                                    onChange={(e) =>
                                        setForm((p) => ({ ...p, duration_seconds: Number(e.target.value) || 0 }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <label className="text-sm font-medium">Price</label>
                                <Input
                                    type="number"
                                    className="mt-1"
                                    value={form.price}
                                    onChange={(e) =>
                                        setForm((p) => ({ ...p, price: Number(e.target.value) || 0 }))
                                    }
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">List Price</label>
                                <Input
                                    type="number"
                                    className="mt-1"
                                    value={form.list_price}
                                    onChange={(e) =>
                                        setForm((p) => ({ ...p, list_price: Number(e.target.value) || 0 }))
                                    }
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
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                id="is_active"
                                type="checkbox"
                                checked={form.is_active}
                                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                            />
                            <label htmlFor="is_active">Active</label>
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Template
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </DefaultLayout>
    )
}
