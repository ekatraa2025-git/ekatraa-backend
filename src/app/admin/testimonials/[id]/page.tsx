'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { uploadFile } from '@/utils/storage'
import { AdminImage } from '@/components/Common/AdminImage'
import { toast } from 'sonner'

export default function EditTestimonialPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [form, setForm] = useState({
        display_name: '',
        testimonial_text: '',
        video_url: '',
        voice_recording_url: '',
        image_url: '',
        display_order: 0,
        is_active: true,
    })

    useEffect(() => {
        fetch(`/api/admin/testimonials/${id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.error) {
                    toast.error(data.error)
                    router.push('/admin/testimonials')
                    return
                }
                setForm({
                    display_name: data.display_name || '',
                    testimonial_text: data.testimonial_text || '',
                    video_url: data.video_url || '',
                    voice_recording_url: data.voice_recording_url || '',
                    image_url: data.image_url || '',
                    display_order: data.display_order ?? 0,
                    is_active: data.is_active !== false,
                })
            })
            .finally(() => setFetching(false))
    }, [id, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.display_name.trim()) {
            toast.error('Name is required')
            return
        }
        setLoading(true)
        const res = await fetch(`/api/admin/testimonials/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const data = await res.json()
        setLoading(false)
        if (data.error) toast.error(data.error)
        else router.push('/admin/testimonials')
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
            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle>Edit testimonial</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Display name</label>
                            <Input
                                className="mt-1"
                                value={form.display_name}
                                onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Quote / text</label>
                            <textarea
                                className="mt-1 w-full rounded-md border px-3 py-2 min-h-[100px]"
                                value={form.testimonial_text}
                                onChange={(e) => setForm((p) => ({ ...p, testimonial_text: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">YouTube video URL</label>
                            <Input
                                className="mt-1"
                                value={form.video_url}
                                onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Voice recording URL</label>
                            <Input
                                className="mt-1"
                                value={form.voice_recording_url}
                                onChange={(e) => setForm((p) => ({ ...p, voice_recording_url: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Image</label>
                            <div className="mt-2 flex items-center gap-4">
                                {form.image_url ? (
                                    <AdminImage
                                        url={form.image_url}
                                        alt=""
                                        className="h-20 w-20 rounded-lg object-cover border"
                                        placeholderClassName="h-20 w-20 rounded-lg bg-muted"
                                    />
                                ) : null}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const url = await uploadFile(file, 'testimonials')
                                        if (url) setForm((p) => ({ ...p, image_url: url }))
                                    }}
                                    className="text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Display order</label>
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
                                type="checkbox"
                                id="is_active"
                                checked={form.is_active}
                                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                            />
                            <label htmlFor="is_active">Active</label>
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
