'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const DEFAULT_EVENT_TYPE_IDS = ['wedding', 'janayu', 'social', 'birthday', 'corporate', 'funeral']

export default function NewAppServiceCatalogPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [eventTypes, setEventTypes] = useState<{ id: string; name: string }[]>([])
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        icon: '🎯',
        event_types: [] as string[],
        display_order: 0,
        is_active: true,
    })

    useEffect(() => {
        fetch('/api/admin/event-types')
            .then(r => r.json())
            .then(data => {
                if (!data.error && Array.isArray(data)) {
                    setEventTypes(data.filter((e: { id: string }) => e.id !== 'all'))
                }
            })
    }, [])

    const handleChange = (name: string, value: string | number | boolean | string[]) => {
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const toggleEventType = (id: string) => {
        setFormData(prev => ({
            ...prev,
            event_types: prev.event_types.includes(id)
                ? prev.event_types.filter(e => e !== id)
                : [...prev.event_types, id]
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.id.trim() || !formData.name.trim()) {
            alert('ID and name are required.')
            return
        }
        setLoading(true)
        const res = await fetch('/api/admin/app-service-catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, event_types: formData.event_types.length ? formData.event_types : DEFAULT_EVENT_TYPE_IDS }),
        })
        const result = await res.json()
        setLoading(false)
        if (result.error) alert(result.error)
        else router.push('/admin/app-service-catalog')
    }

    const inputClass = 'w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-black dark:bg-form-input dark:text-white'
    const labelClass = 'mb-2 block text-sm font-medium text-black dark:text-white'

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-2xl">
                <div className="mb-6">
                    <h2 className="text-3xl font-bold tracking-tight text-black dark:text-white">Add Event Service</h2>
                    <p className="text-muted-foreground">This service will show in the app for the selected get-together types.</p>
                </div>
                <form onSubmit={handleSubmit} className="rounded-lg border border-stroke bg-white p-6 shadow dark:border-strokedark dark:bg-boxdark">
                    <div className="space-y-4">
                        <div>
                            <label className={labelClass}>ID (unique, lowercase, e.g. venue) *</label>
                            <input type="text" value={formData.id} onChange={e => handleChange('id', e.target.value.toLowerCase().replace(/\s/g, '_'))} required className={inputClass} placeholder="e.g. venue" />
                        </div>
                        <div>
                            <label className={labelClass}>Name *</label>
                            <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} required className={inputClass} placeholder="e.g. Venue" />
                        </div>
                        <div>
                            <label className={labelClass}>Icon (emoji)</label>
                            <input type="text" value={formData.icon} onChange={e => handleChange('icon', e.target.value)} className={inputClass} placeholder="🏰" maxLength={4} />
                        </div>
                        <div>
                            <label className={labelClass}>Show for get-together types</label>
                            <p className="text-xs text-muted-foreground mb-2">Select which event types this service appears for in the app.</p>
                            <div className="flex flex-wrap gap-3">
                                {(eventTypes.length ? eventTypes : DEFAULT_EVENT_TYPE_IDS.map(id => ({ id, name: id }))).map((et: { id: string; name: string }) => (
                                    <label key={et.id} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.event_types.includes(et.id)}
                                            onChange={() => toggleEventType(et.id)}
                                            className="rounded border-stroke"
                                        />
                                        <span className="text-sm">{et.name}</span>
                                    </label>
                                ))}
                            </div>
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
                            Save
                        </button>
                        <button type="button" onClick={() => router.push('/admin/app-service-catalog')} className="rounded-lg border px-4 py-2">Cancel</button>
                    </div>
                </form>
            </div>
        </DefaultLayout>
    )
}
