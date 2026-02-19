'use client'

import React, { useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter } from 'next/navigation'
import { Loader2, ImageIcon } from 'lucide-react'
import { uploadFile } from '@/utils/storage'

export default function NewBannerPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        description: '',
        image_url: '',
        link_url: '',
        banner_type: 'promotional',
        display_order: 0,
        is_active: true,
    })

    const handleChange = (name: string, value: string | number | boolean) => {
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const url = await uploadFile(file, 'banners')
        setUploading(false)
        if (url) handleChange('image_url', url)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title || !formData.image_url) {
            alert('Title and image are required.')
            return
        }
        setLoading(true)
        const res = await fetch('/api/admin/banners', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        })
        const result = await res.json()
        setLoading(false)
        if (result.error) alert(result.error)
        else router.push('/admin/banners')
    }

    const inputClass = 'w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-black dark:bg-form-input dark:text-white'
    const labelClass = 'mb-2 block text-sm font-medium text-black dark:text-white'

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-2xl">
                <div className="mb-6">
                    <h2 className="text-3xl font-bold tracking-tight text-black dark:text-white">Add Banner</h2>
                    <p className="text-muted-foreground">Create a new banner for the app home screen.</p>
                </div>
                <form onSubmit={handleSubmit} className="rounded-lg border border-stroke bg-white p-6 shadow dark:border-strokedark dark:bg-boxdark">
                    <div className="space-y-4">
                        <div>
                            <label className={labelClass}>Title *</label>
                            <input type="text" value={formData.title} onChange={e => handleChange('title', e.target.value)} required className={inputClass} placeholder="Banner title" />
                        </div>
                        <div>
                            <label className={labelClass}>Subtitle</label>
                            <input type="text" value={formData.subtitle} onChange={e => handleChange('subtitle', e.target.value)} className={inputClass} placeholder="Short subtitle" />
                        </div>
                        <div>
                            <label className={labelClass}>Image *</label>
                            <div className="flex items-center gap-4">
                                <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
                                {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
                            </div>
                            {formData.image_url && (
                                <img src={formData.image_url} alt="Preview" className="mt-2 h-24 w-40 rounded object-cover" />
                            )}
                            <input type="hidden" value={formData.image_url} readOnly />
                        </div>
                        <div>
                            <label className={labelClass}>Or image URL</label>
                            <input type="url" value={formData.image_url} onChange={e => handleChange('image_url', e.target.value)} className={inputClass} placeholder="https://..." />
                        </div>
                        <div>
                            <label className={labelClass}>Banner type</label>
                            <select value={formData.banner_type} onChange={e => handleChange('banner_type', e.target.value)} className={inputClass}>
                                <option value="promotional">Promotional</option>
                                <option value="success_story">Success Story</option>
                                <option value="event">Event</option>
                                <option value="announcement">Announcement</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Display order</label>
                            <input type="number" value={formData.display_order} onChange={e => handleChange('display_order', parseInt(e.target.value) || 0)} className={inputClass} min={0} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="is_active" checked={formData.is_active} onChange={e => handleChange('is_active', e.target.checked)} />
                            <label htmlFor="is_active" className={labelClass + ' mb-0'}>Active</label>
                        </div>
                    </div>
                    <div className="mt-6 flex gap-3">
                        <button type="submit" disabled={loading} className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50 flex items-center gap-2">
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Save Banner
                        </button>
                        <button type="button" onClick={() => router.push('/admin/banners')} className="rounded-lg border px-4 py-2">Cancel</button>
                    </div>
                </form>
            </div>
        </DefaultLayout>
    )
}
