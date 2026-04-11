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
import { Edit, Loader2, MoreHorizontal, Trash2, Image as ImageIcon, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'

type EInviteTemplate = {
    id: string
    section_key: string
    title: string
    subtitle?: string | null
    thumbnail_url?: string | null
    template_type?: string | null
    duration_seconds?: number | null
    price?: number | null
    list_price?: number | null
    display_order?: number | null
    is_active?: boolean
}

type EInviteFaq = {
    id: string
    question: string
    answer: string
    display_order?: number | null
    is_active?: boolean
}

function sectionLabel(key: string): string {
    const map: Record<string, string> = {
        wedding_cards: 'Wedding Cards',
        video_invites: 'Video Invites',
        save_the_date: 'Save The Date',
    }
    return map[key] || key
}

export default function EInvitesAdminPage() {
    const [loading, setLoading] = useState(true)
    const [templates, setTemplates] = useState<EInviteTemplate[]>([])
    const [faqs, setFaqs] = useState<EInviteFaq[]>([])
    const [filteredTemplates, setFilteredTemplates] = useState<EInviteTemplate[]>([])
    const [filteredFaqs, setFilteredFaqs] = useState<EInviteFaq[]>([])
    const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<{ id: string; title: string } | null>(null)
    const [deleteFaqTarget, setDeleteFaqTarget] = useState<{ id: string; question: string } | null>(null)

    const fetchAll = async () => {
        setLoading(true)
        try {
            const [tplRes, faqRes] = await Promise.all([
                fetch('/api/admin/e-invites/templates'),
                fetch('/api/admin/e-invites/faqs'),
            ])
            const [tplJson, faqJson] = await Promise.all([tplRes.json(), faqRes.json()])
            const tplList = Array.isArray(tplJson) ? tplJson : []
            const faqList = Array.isArray(faqJson) ? faqJson : []
            setTemplates(tplList)
            setFilteredTemplates(tplList)
            setFaqs(faqList)
            setFilteredFaqs(faqList)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAll()
    }, [])

    const templateColumns = useMemo(
        () => [
            {
                header: 'Thumb',
                key: 'thumbnail_url',
                render: (url: string | null) =>
                    url ? (
                        <AdminImage
                            url={url}
                            alt=""
                            className="h-12 w-12 rounded-md object-cover"
                            placeholderClassName="h-12 w-12 rounded-md bg-muted"
                        />
                    ) : (
                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                    ),
            },
            { header: 'Title', key: 'title' },
            {
                header: 'Section',
                key: 'section_key',
                render: (v: string) => sectionLabel(v),
            },
            {
                header: 'Type',
                key: 'template_type',
                render: (v: string | null) => <Badge variant="outline">{v || 'image'}</Badge>,
            },
            {
                header: 'Price',
                key: 'price',
                render: (v: number | null) =>
                    Number.isFinite(Number(v)) ? `₹${Number(v).toLocaleString('en-IN')}` : '—',
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

    const onTemplateSearch = (value: string) => {
        const q = value.toLowerCase()
        setFilteredTemplates(
            templates.filter(
                (t) =>
                    t.title?.toLowerCase().includes(q) ||
                    (t.subtitle || '').toLowerCase().includes(q) ||
                    (t.section_key || '').toLowerCase().includes(q)
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

    const deleteTemplate = async () => {
        if (!deleteTemplateTarget) return
        const res = await fetch(`/api/admin/e-invites/templates/${deleteTemplateTarget.id}`, {
            method: 'DELETE',
        })
        const data = await res.json()
        if (data?.error) toast.error(data.error)
        else {
            toast.success('Template deleted')
            fetchAll()
        }
        setDeleteTemplateTarget(null)
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
                <DataTableView
                    title="E-Invite Templates"
                    description="Manage wedding cards, video invites, and save-the-date templates."
                    columns={templateColumns}
                    data={filteredTemplates}
                    onSearch={onTemplateSearch}
                    addNewLink="/admin/e-invites/new"
                    addNewLabel="Add template"
                    actions={(item: EInviteTemplate) => (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                    <Link href={`/admin/e-invites/${item.id}`} className="flex items-center">
                                        <Edit className="mr-2 h-4 w-4" />
                                        Edit
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus:bg-destructive/10"
                                    onClick={() =>
                                        setDeleteTemplateTarget({
                                            id: item.id,
                                            title: item.title || 'Template',
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

                <DataTableView
                    title="E-Invite FAQs"
                    description="Dynamic FAQ items shown in the app invite flow."
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

            <ConfirmDialog
                open={!!deleteTemplateTarget}
                onOpenChange={(open) => !open && setDeleteTemplateTarget(null)}
                title="Delete template"
                description={`Remove "${deleteTemplateTarget?.title}"?`}
                onConfirm={deleteTemplate}
            />
            <ConfirmDialog
                open={!!deleteFaqTarget}
                onOpenChange={(open) => !open && setDeleteFaqTarget(null)}
                title="Delete FAQ"
                description={`Remove "${deleteFaqTarget?.question}"?`}
                onConfirm={deleteFaq}
            />
        </DefaultLayout>
    )
}
