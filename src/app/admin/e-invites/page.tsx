'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { DataTableView } from '@/components/admin-panel/data-table-view'
import { ConfirmDialog } from '@/components/Common/ConfirmDialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AdminImage } from '@/components/Common/AdminImage'
import { Edit, ExternalLink, Loader2, MoreHorizontal, Trash2, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'

type UserEInvite = {
    id: string
    user_id: string
    media_kind: string
    status: string
    price_inr: number
    storage_path: string
    form_payload?: Record<string, unknown> | null
    preview_url?: string | null
    created_at?: string
    paid_at?: string | null
    admin_note?: string | null
}

type EInviteFaq = {
    id: string
    question: string
    answer: string
    display_order?: number | null
    is_active?: boolean
}

export default function EInvitesAdminPage() {
    const [loading, setLoading] = useState(true)
    const [invites, setInvites] = useState<UserEInvite[]>([])
    const [filteredInvites, setFilteredInvites] = useState<UserEInvite[]>([])
    const [faqs, setFaqs] = useState<EInviteFaq[]>([])
    const [filteredFaqs, setFilteredFaqs] = useState<EInviteFaq[]>([])
    const [deleteFaqTarget, setDeleteFaqTarget] = useState<{ id: string; question: string } | null>(null)
    const [editRow, setEditRow] = useState<UserEInvite | null>(null)
    const [editNote, setEditNote] = useState('')
    const [savingNote, setSavingNote] = useState(false)
    const [deleteInviteTarget, setDeleteInviteTarget] = useState<{ id: string; label: string } | null>(null)
    const [pricing, setPricing] = useState({ static_inr: 300, animated_inr: 500 })
    const [savingPricing, setSavingPricing] = useState(false)

    const fetchAll = async () => {
        setLoading(true)
        try {
            const [invRes, faqRes, settingsRes] = await Promise.all([
                fetch('/api/admin/user-e-invites?limit=120'),
                fetch('/api/admin/e-invites/faqs'),
                fetch('/api/admin/platform-settings'),
            ])
            const invJson = await invRes.json()
            const faqJson = await faqRes.json()
            const settingsJson = await settingsRes.json()
            const invList = Array.isArray(invJson?.invites) ? invJson.invites : []
            const faqList = Array.isArray(faqJson) ? faqJson : []
            setInvites(invList)
            setFilteredInvites(invList)
            setFaqs(faqList)
            setFilteredFaqs(faqList)
            setPricing({
                static_inr: Number(settingsJson?.e_invite_static_inr || 300),
                animated_inr: Number(settingsJson?.e_invite_animated_inr || 500),
            })
        } catch {
            toast.error('Could not load e-invites')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAll()
    }, [])

    const inviteColumns = useMemo(
        () => [
            {
                header: 'Preview',
                key: 'preview_url',
                render: (_url: unknown, row: UserEInvite) =>
                    row.preview_url ? (
                        <AdminImage
                            url={row.preview_url}
                            alt=""
                            className="h-14 w-10 rounded-md object-cover"
                            placeholderClassName="h-14 w-10 rounded-md bg-muted"
                        />
                    ) : (
                        <div className="h-14 w-10 rounded-md bg-muted" />
                    ),
            },
            {
                header: 'User',
                key: 'user_id',
                render: (v: string) => <span className="font-mono text-xs">{String(v).slice(0, 8)}…</span>,
            },
            {
                header: 'Kind',
                key: 'media_kind',
                render: (v: string) => <Badge variant="outline">{v}</Badge>,
            },
            {
                header: 'Status',
                key: 'status',
                render: (v: string) => (
                    <Badge variant={v === 'paid' ? 'secondary' : v === 'cancelled' ? 'outline' : 'default'}>{v}</Badge>
                ),
            },
            {
                header: '₹',
                key: 'price_inr',
                render: (v: number) => `₹${Number(v || 0).toLocaleString('en-IN')}`,
            },
            {
                header: 'Created',
                key: 'created_at',
                render: (v: string) => (v ? new Date(v).toLocaleString() : '—'),
            },
        ],
        []
    )

    const faqColumns = useMemo(
        () => [
            { header: 'Question', key: 'question' },
            {
                header: 'Answer',
                key: 'answer',
                render: (v: string) => (
                    <span className="line-clamp-2 max-w-[420px] text-muted-foreground">{v || '—'}</span>
                ),
            },
            { header: 'Order', key: 'display_order' },
            {
                header: 'Active',
                key: 'is_active',
                render: (v: boolean) => (
                    <Badge variant={v ? 'secondary' : 'outline'}>{v ? 'Yes' : 'No'}</Badge>
                ),
            },
        ],
        []
    )

    const onInviteSearch = (value: string) => {
        const q = value.toLowerCase()
        setFilteredInvites(
            invites.filter(
                (r) =>
                    r.id.toLowerCase().includes(q) ||
                    r.user_id.toLowerCase().includes(q) ||
                    (r.status || '').toLowerCase().includes(q)
            )
        )
    }

    const onFaqSearch = (value: string) => {
        const q = value.toLowerCase()
        setFilteredFaqs(
            faqs.filter(
                (f) =>
                    f.question?.toLowerCase().includes(q) ||
                    (f.answer || '').toLowerCase().includes(q)
            )
        )
    }

    const adminDownload = async (id: string) => {
        const res = await fetch(`/api/admin/user-e-invites/${id}/signed-url`)
        const json = await res.json().catch(() => ({}))
        if (json?.url) window.open(json.url, '_blank', 'noopener,noreferrer')
        else toast.error(json?.error || 'Could not get download URL')
    }

    const deleteFaq = async () => {
        if (!deleteFaqTarget) return
        const res = await fetch(`/api/admin/e-invites/faqs/${deleteFaqTarget.id}`, {
            method: 'DELETE',
        })
        const data = await res.json()
        if (data?.error) toast.error(data.error)
        else {
            toast.success('FAQ deleted')
            fetchAll()
        }
        setDeleteFaqTarget(null)
    }

    const deleteInvite = async () => {
        if (!deleteInviteTarget) return
        const res = await fetch(`/api/admin/user-e-invites/${deleteInviteTarget.id}`, {
            method: 'DELETE',
        })
        const data = await res.json().catch(() => ({}))
        if (data?.error) toast.error(data.error)
        else {
            toast.success('Invite deleted')
            fetchAll()
        }
        setDeleteInviteTarget(null)
    }

    const bulkDeleteInvites = async (ids: string[]) => {
        if (!ids.length) return
        const res = await fetch('/api/admin/user-e-invites', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids }),
        })
        const data = await res.json().catch(() => ({}))
        if (data?.error) {
            toast.error(data.error)
            return
        }
        toast.success(`Deleted ${ids.length} invite${ids.length === 1 ? '' : 's'}`)
        await fetchAll()
    }

    const savePricing = async () => {
        setSavingPricing(true)
        try {
            const res = await fetch('/api/admin/platform-settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    e_invite_static_inr: Math.max(1, Math.round(Number(pricing.static_inr))),
                    e_invite_animated_inr: Math.max(1, Math.round(Number(pricing.animated_inr))),
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || json?.error) {
                toast.error(json?.error || 'Could not save pricing')
                return
            }
            toast.success('E-invite pricing updated')
        } finally {
            setSavingPricing(false)
        }
    }

    const saveAdminNote = async () => {
        if (!editRow) return
        setSavingNote(true)
        try {
            const res = await fetch(`/api/admin/user-e-invites/${editRow.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_note: editNote }),
            })
            const json = await res.json()
            if (json?.error) toast.error(json.error)
            else {
                toast.success('Saved')
                setEditRow(null)
                fetchAll()
            }
        } finally {
            setSavingNote(false)
        }
    }

    if (loading) {
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
            <div className="space-y-8">
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">AI e-invites (user-generated)</p>
                    <p className="mt-1">
                        Fixed pricing: <strong>₹300</strong> static image, <strong>₹500</strong> animated (MP4 when ffmpeg is available, else GIF). Users pay
                        in-app after generation; downloads unlock after Razorpay confirmation.
                    </p>
                    <div className="mt-4 grid max-w-md grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                            <p className="mb-1 text-xs font-medium text-foreground">Static (INR)</p>
                            <Input
                                type="number"
                                min={1}
                                value={pricing.static_inr}
                                onChange={(e) =>
                                    setPricing((p) => ({ ...p, static_inr: Number(e.target.value) || 1 }))
                                }
                            />
                        </div>
                        <div>
                            <p className="mb-1 text-xs font-medium text-foreground">Animated (INR)</p>
                            <Input
                                type="number"
                                min={1}
                                value={pricing.animated_inr}
                                onChange={(e) =>
                                    setPricing((p) => ({ ...p, animated_inr: Number(e.target.value) || 1 }))
                                }
                            />
                        </div>
                    </div>
                    <Button className="mt-3" onClick={() => void savePricing()} disabled={savingPricing}>
                        {savingPricing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save pricing
                    </Button>
                </div>

                <DataTableView
                    title="Generated e-invites by user"
                    description="Preview, download, and attach admin notes. Edit record updates metadata only — not the image file."
                    columns={inviteColumns}
                    data={filteredInvites}
                    onSearch={onInviteSearch}
                    selectable
                    onBulkDelete={bulkDeleteInvites}
                    actions={(item: UserEInvite) => (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => adminDownload(item.id)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download file
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        setEditRow(item)
                                        setEditNote(String(item.admin_note || ''))
                                    }}
                                >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit / note
                                </DropdownMenuItem>
                                {item.preview_url ? (
                                    <DropdownMenuItem onClick={() => window.open(item.preview_url!, '_blank')}>
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Open preview
                                    </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus:bg-destructive/10"
                                    onClick={() =>
                                        setDeleteInviteTarget({
                                            id: item.id,
                                            label: String(item.form_payload?.event_name || item.id),
                                        })
                                    }
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete invite
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                />

                <DataTableView
                    title="E-Invite FAQs"
                    description="FAQ items shown in the app invite flow."
                    columns={faqColumns}
                    data={filteredFaqs}
                    onSearch={onFaqSearch}
                    addNewLink="/admin/e-invites/faqs/new"
                    addNewLabel="Add FAQ"
                    actions={(item: EInviteFaq) => (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                    <Link href={`/admin/e-invites/faqs/${item.id}`} className="flex items-center">
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus:bg-destructive/10"
                                    onClick={() =>
                                        setDeleteFaqTarget({
                                            id: item.id,
                                            question: item.question || 'FAQ',
                                        })
                                    }
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                />
            </div>

            {editRow ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg border bg-card p-6 shadow-lg">
                        <h3 className="text-lg font-semibold">Admin note &amp; context</h3>
                        <div className="mt-4 space-y-3 text-sm">
                            <div>
                                <p className="mb-1 text-muted-foreground">Invite id</p>
                                <Input readOnly value={editRow.id} className="font-mono text-xs" />
                            </div>
                            <div>
                                <p className="mb-1 text-muted-foreground">Form payload</p>
                                <pre className="max-h-40 overflow-auto rounded border bg-muted p-2 text-xs">
                                    {JSON.stringify(editRow.form_payload || {}, null, 2)}
                                </pre>
                            </div>
                            <div>
                                <p className="mb-1 text-muted-foreground">Admin note</p>
                                <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Internal note" />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
                                    Cancel
                                </Button>
                                <Button type="button" onClick={() => void saveAdminNote()} disabled={savingNote}>
                                    {savingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Save note
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <ConfirmDialog
                open={!!deleteFaqTarget}
                onOpenChange={(open) => !open && setDeleteFaqTarget(null)}
                title="Delete FAQ"
                description={`Remove "${deleteFaqTarget?.question}"?`}
                onConfirm={deleteFaq}
            />
            <ConfirmDialog
                open={!!deleteInviteTarget}
                onOpenChange={(open) => !open && setDeleteInviteTarget(null)}
                title="Delete e-invite"
                description={`Delete "${deleteInviteTarget?.label}" and its stored media file?`}
                onConfirm={deleteInvite}
            />
        </DefaultLayout>
    )
}
