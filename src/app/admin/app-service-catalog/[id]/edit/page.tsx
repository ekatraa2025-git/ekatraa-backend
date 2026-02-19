'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter, useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const DEFAULT_EVENT_TYPE_IDS = ['wedding', 'janayu', 'social', 'birthday', 'corporate', 'funeral']

export default function EditAppServiceCatalogPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
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
        Promise.all([
            fetch(`/api/admin/app-service-catalog/${id}`).then(r => r.json()),
            fetch('/api/admin/event-types').then(r => r.json()),
        ]).then(([item, eventTypesData]) => {
            if (item.error) {
                alert(item.error)
                router.push('/admin/app-service-catalog')
                return
            }
            setFormData({
                id: item.id || '',
                name: item.name || '',
                icon: item.icon || '🎯',
                event_types: Array.isArray(item.event_types) ? item.event_types : [],
                display_order: item.display_order ?? 0,
                is_active: item.is_active !== false,
            })
            if (!eventTypesData.error && Array.isArray(eventTypesData)) {
                setEventTypes(eventTypesData.filter((e: { id: string }) => e.id !== 'all'))
            }
        }).finally(() => setFetching(false))
    }, [id, router])

    const handleChange = (name: string, value: string | number | boolean | string[]) => {
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const toggleEventType = (eventTypeId: string) => {
        setFormData(prev => ({
            ...prev,
            event_types: prev.event_types.includes(eventTypeId)
                ? prev.event_types.filter(e => e !== eventTypeId)
                : [...prev.event_types, eventTypeId]
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const res = await fetch(`/api/admin/app-service-catalog/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        })
        const result = await res.json()
        setLoading(false)
        if (result.error) alert(result.error)
        else router.push('/admin/app-service-catalog')
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
                    <h2 className="text-3xl font-bold tracking-tight text-black dark:text-white">Edit Event Service</h2>
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
                            <label className={labelClass}>Icon (emoji)</label>
                            <input type="text" value={formData.icon} onChange={e => handleChange('icon', e.target.value)} className={inputClass} maxLength={4} />
                        </div>
                        <div>
                            <label className={labelClass}>Show for get-together types</label>
                            <p className="text-xs text-muted-foreground mb-2">Select which event types this service appears for in the app.</p>
                            <div className="flex flex-wrap gap-3">
                                {(eventTypes.length ? eventTypes : DEFAULT_EVENT_TYPE_IDS.map(etId => ({ id: etId, name: etId }))).map((et: { id: string; name: string }) => (
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
                            Save Changes
                        </button>
                        <button type="button" onClick={() => router.push('/admin/app-service-catalog')} className="rounded-lg border px-4 py-2">Cancel</button>
                    </div>
                </form>
            </div>
        </DefaultLayout>
    )
}
