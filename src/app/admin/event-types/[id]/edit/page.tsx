'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { uploadFile } from '@/utils/storage'

const PRESET_COLORS = ['#FF4117', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#6366F1', '#14B8A6']

export default function EditEventTypePage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        icon: '🎉',
        image_url: '',
        color: '',
        display_order: 0,
        is_active: true,
    })

    useEffect(() => {
        fetch(`/api/admin/event-types/${id}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    alert(data.error)
                    router.push('/admin/event-types')
                    return
                }
                setFormData({
                    id: data.id || '',
                    name: data.name || '',
                    icon: data.icon || '🎉',
                    image_url: data.image_url || '',
                    color: data.color || '#FF4117',
                    display_order: data.display_order ?? 0,
                    is_active: data.is_active !== false,
                })
            })
            .finally(() => setFetching(false))
    }, [id, router])

    const handleChange = (name: string, value: string | number | boolean) => {
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const url = await uploadFile(file, 'event-types')
        setUploading(false)
        if (url) handleChange('image_url', url)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await fetch(`/api/admin/event-types/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        })
        const result = await res.json()
        setLoading(false)
        if (result.error) alert(result.error)
        else router.push('/admin/event-types')
    }

    const inputClass = 'w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-black dark:bg-form-input dark:text-white'
    const labelClass = 'mb-2 block text-sm font-medium text-black dark:text-white'

    if (fetching) {
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
            <div className="mx-auto max-w-2xl">
                <div className="mb-6">
                    <h2 className="text-3xl font-bold tracking-tight text-black dark:text-white">Edit Get Together Type</h2>
                </div>
                <form onSubmit={handleSubmit} className="rounded-lg border border-stroke bg-white p-6 shadow dark:border-strokedark dark:bg-boxdark">
                    <div className="space-y-4">
                        <div>
                            <label className={labelClass}>ID</label>
                            <input type="text" value={formData.id} readOnly className={inputClass + ' bg-muted'} />
                        </div>
                        <div>
                            <label className={labelClass}>Name *</label>
                            <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} required className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Emoji icon (fallback)</label>
                            <input type="text" value={formData.icon} onChange={e => handleChange('icon', e.target.value)} className={inputClass} maxLength={4} />
                        </div>
                        <div>
                            <label className={labelClass}>Image (optional)</label>
                            <div className="flex items-center gap-4">
                                <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
                                {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
                            </div>
                            {formData.image_url && <img src={formData.image_url} alt="Preview" className="mt-2 h-16 w-16 rounded object-cover" />}
                            <input type="url" value={formData.image_url} onChange={e => handleChange('image_url', e.target.value)} className={inputClass + ' mt-2'} placeholder="Image URL" />
                        </div>
                        <div>
                            <label className={labelClass}>Color (for app card)</label>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {PRESET_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => handleChange('color', c)} className={`h-8 w-8 rounded-full border-2 ${formData.color === c ? 'border-black ring-2 ring-offset-2' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                                ))}
                            </div>
                            <input type="text" value={formData.color} onChange={e => handleChange('color', e.target.value)} className={inputClass + ' mt-2'} placeholder="#FF4117" />
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
                            Save Changes
                        </button>
                        <button type="button" onClick={() => router.push('/admin/event-types')} className="rounded-lg border px-4 py-2">Cancel</button>
                    </div>
                </form>
            </div>
        </DefaultLayout>
    )
}
