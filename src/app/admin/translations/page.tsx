'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { Loader2, Plus, Edit, Save, X, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card'

interface Translation {
    key: string
    en: string
    hi: string
    or: string
}

export default function TranslationsPage() {
    const [translations, setTranslations] = useState<Translation[]>([])
    const [filteredTranslations, setFilteredTranslations] = useState<Translation[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [editData, setEditData] = useState<Translation | null>(null)
    const [newTranslation, setNewTranslation] = useState<Translation>({ key: '', en: '', hi: '', or: '' })
    const [showAddForm, setShowAddForm] = useState(false)

    useEffect(() => {
        fetchTranslations()
    }, [])

    const fetchTranslations = async () => {
        try {
            const res = await fetch('/api/admin/translations')
            const data = await res.json()

            if (data.translations) {
                // Default translations (table doesn't exist)
                setTranslations(data.translations)
                setFilteredTranslations(data.translations)
            } else if (Array.isArray(data)) {
                setTranslations(data)
                setFilteredTranslations(data)
            } else if (data.error) {
                console.error('API Error:', data.error)
            }
        } catch (error) {
            console.error('Failed to fetch translations:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (val: string) => {
        const filtered = translations.filter(t =>
            t.key?.toLowerCase().includes(val.toLowerCase()) ||
            t.en?.toLowerCase().includes(val.toLowerCase()) ||
            t.hi?.toLowerCase().includes(val.toLowerCase()) ||
            t.or?.toLowerCase().includes(val.toLowerCase())
        )
        setFilteredTranslations(filtered)
    }

    const handleEdit = (translation: Translation) => {
        setEditingKey(translation.key)
        setEditData({ ...translation })
    }

    const handleSave = async () => {
        if (!editData) return

        setSaving(true)
        try {
            const res = await fetch('/api/admin/translations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editData)
            })

            const result = await res.json()

            if (result.error) {
                alert(result.error)
            } else {
                // Update local state
                const updated = translations.map(t =>
                    t.key === editData.key ? editData : t
                )
                setTranslations(updated)
                setFilteredTranslations(updated)
                setEditingKey(null)
                setEditData(null)
            }
        } catch (error: any) {
            alert('Failed to save: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    const handleAddNew = async () => {
        if (!newTranslation.key) {
            alert('Key is required')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/admin/translations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTranslation)
            })

            const result = await res.json()

            if (result.error) {
                alert(result.error)
            } else {
                // Add to local state
                const updated = [...translations, newTranslation]
                setTranslations(updated)
                setFilteredTranslations(updated)
                setNewTranslation({ key: '', en: '', hi: '', or: '' })
                setShowAddForm(false)
            }
        } catch (error: any) {
            alert('Failed to add: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    const columns = [
        {
            header: 'Key',
            key: 'key',
            render: (val: string) => <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{val}</span>
        },
        {
            header: 'English',
            key: 'en',
            render: (val: string, row: Translation) => editingKey === row.key ? (
                <Input
                    value={editData?.en || ''}
                    onChange={(e) => setEditData(prev => prev ? { ...prev, en: e.target.value } : null)}
                    className="h-8"
                />
            ) : (
                <span className="text-sm">{val || '-'}</span>
            )
        },
        {
            header: 'Hindi (हिन्दी)',
            key: 'hi',
            render: (val: string, row: Translation) => editingKey === row.key ? (
                <Input
                    value={editData?.hi || ''}
                    onChange={(e) => setEditData(prev => prev ? { ...prev, hi: e.target.value } : null)}
                    className="h-8"
                />
            ) : (
                <span className="text-sm">{val || '-'}</span>
            )
        },
        {
            header: 'Odia (ଓଡ଼ିଆ)',
            key: 'or',
            render: (val: string, row: Translation) => editingKey === row.key ? (
                <Input
                    value={editData?.or || ''}
                    onChange={(e) => setEditData(prev => prev ? { ...prev, or: e.target.value } : null)}
                    className="h-8"
                />
            ) : (
                <span className="text-sm">{val || '-'}</span>
            )
        },
    ]

    if (loading) {
        return (
            <DefaultLayout>
                <div className="flex h-60 items-center justify-center">
                    <Loader2 className="animate-spin text-primary w-8 h-8" />
                </div>
            </DefaultLayout>
        )
    }

    return (
        <DefaultLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Languages className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight">Translations</h2>
                            <p className="text-muted-foreground">Manage app language translations for English, Hindi, and Odia</p>
                        </div>
                    </div>
                    <Button onClick={() => setShowAddForm(!showAddForm)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Translation
                    </Button>
                </div>

                {showAddForm && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Add New Translation</CardTitle>
                            <CardDescription>Add a new translation key with values for all languages</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Key</label>
                                    <Input
                                        placeholder="e.g. welcome_message"
                                        value={newTranslation.key}
                                        onChange={(e) => setNewTranslation(prev => ({ ...prev, key: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">English</label>
                                    <Input
                                        placeholder="English text"
                                        value={newTranslation.en}
                                        onChange={(e) => setNewTranslation(prev => ({ ...prev, en: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Hindi (हिन्दी)</label>
                                    <Input
                                        placeholder="Hindi text"
                                        value={newTranslation.hi}
                                        onChange={(e) => setNewTranslation(prev => ({ ...prev, hi: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Odia (ଓଡ଼ିଆ)</label>
                                    <Input
                                        placeholder="Odia text"
                                        value={newTranslation.or}
                                        onChange={(e) => setNewTranslation(prev => ({ ...prev, or: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleAddNew} disabled={saving}>
                                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save
                                </Button>
                                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <DataTableView
                    title=""
                    description=""
                    columns={columns}
                    data={filteredTranslations}
                    onSearch={handleSearch}
                    actions={(item: Translation) => (
                        editingKey === item.key ? (
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleSave} disabled={saving}>
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingKey(null); setEditData(null); }}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                        )
                    )}
                />
            </div>
        </DefaultLayout>
    )
}

