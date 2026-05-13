'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Bot, Wallet } from 'lucide-react'
import { toast } from 'sonner'

type Provider = 'openrouter' | 'claude' | 'gemini'

type ModelOption = {
    id: string
    name: string
    context_length: number
}

const CLAUDE_DEFAULTS = ['claude-sonnet-4-6', 'claude-opus-4-1', 'claude-haiku-3-5']
const GEMINI_DEFAULTS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.1-flash-lite-preview']
const IMAGE_MODEL_DEFAULTS = [
    'sourceful/riverflow-v2-fast',
    'sourceful/riverflow-v2-pro',
    'black-forest-labs/flux.2-pro',
    'google/gemini-2.5-flash-image',
]

function fmtUsd(v: number) {
    if (!Number.isFinite(v)) return '$0.00'
    return `$${v.toFixed(2)}`
}

export default function AiModelSettings() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [provider, setProvider] = useState<Provider>('openrouter')
    const [primaryModel, setPrimaryModel] = useState('nvidia/nemotron-3-nano-omni:free')
    const [openrouterModel, setOpenrouterModel] = useState('nvidia/nemotron-3-nano-omni:free')
    const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-6')
    const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash')
    const [openrouterImageModel, setOpenrouterImageModel] = useState('sourceful/riverflow-v2-fast')
    const [openrouterModels, setOpenrouterModels] = useState<ModelOption[]>([])
    const [openrouterImageModels, setOpenrouterImageModels] = useState<ModelOption[]>([])
    const [balance, setBalance] = useState<{ total_credits: number; total_usage: number } | null>(null)
    const [orLoading, setOrLoading] = useState(false)

    const activeModel = useMemo(() => {
        if (provider === 'openrouter') return openrouterModel
        if (provider === 'claude') return claudeModel
        return geminiModel
    }, [provider, openrouterModel, claudeModel, geminiModel])

    const imageModelOptions = useMemo(() => {
        const ids = new Set<string>()
        const out: ModelOption[] = []
        for (const id of IMAGE_MODEL_DEFAULTS) {
            if (!id || ids.has(id)) continue
            ids.add(id)
            out.push({ id, name: id, context_length: 0 })
        }
        for (const m of openrouterImageModels) {
            if (!m.id || ids.has(m.id)) continue
            ids.add(m.id)
            out.push(m)
        }
        if (openrouterImageModel && !ids.has(openrouterImageModel)) {
            out.unshift({ id: openrouterImageModel, name: openrouterImageModel, context_length: 0 })
        }
        return out
    }, [openrouterImageModels, openrouterImageModel])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const [settingsRes, modelsRes, imageModelsRes, balanceRes] = await Promise.all([
                    fetch('/api/admin/platform-settings'),
                    fetch('/api/admin/openrouter/models?output_modalities=all'),
                    fetch('/api/admin/openrouter/models?output_modalities=image'),
                    fetch('/api/admin/openrouter/balance'),
                ])
                const settings = await settingsRes.json()
                const modelsJson = await modelsRes.json().catch(() => ({}))
                const imageModelsJson = await imageModelsRes.json().catch(() => ({}))
                const balanceJson = await balanceRes.json().catch(() => ({}))

                if (!cancelled) {
                    if (settings && !settings.error) {
                        const p = String(settings.ai_primary_provider || 'openrouter').toLowerCase()
                        if (p === 'openrouter' || p === 'claude' || p === 'gemini') setProvider(p)
                        setPrimaryModel(String(settings.ai_primary_model || 'nvidia/nemotron-3-nano-omni:free'))
                        setOpenrouterModel(String(settings.ai_openrouter_model || 'nvidia/nemotron-3-nano-omni:free'))
                        setClaudeModel(String(settings.ai_claude_model || 'claude-sonnet-4-6'))
                        setGeminiModel(String(settings.ai_gemini_model || 'gemini-2.0-flash'))
                        setOpenrouterImageModel(String(settings.ai_openrouter_image_model || 'sourceful/riverflow-v2-fast'))
                    }
                    if (Array.isArray(modelsJson?.models)) {
                        setOpenrouterModels(
                            modelsJson.models
                                .map((m: any) => ({
                                    id: String(m.id || ''),
                                    name: String(m.name || m.id || ''),
                                    context_length: Number(m.context_length || 0) || 0,
                                }))
                                .filter((m: ModelOption) => !!m.id)
                        )
                    }
                    if (Array.isArray(imageModelsJson?.models)) {
                        setOpenrouterImageModels(
                            imageModelsJson.models
                                .map((m: any) => ({
                                    id: String(m.id || ''),
                                    name: String(m.name || m.id || ''),
                                    context_length: Number(m.context_length || 0) || 0,
                                }))
                                .filter((m: ModelOption) => !!m.id)
                        )
                    }
                    if (!balanceJson?.error) {
                        setBalance({
                            total_credits: Number(balanceJson.total_credits || 0),
                            total_usage: Number(balanceJson.total_usage || 0),
                        })
                    }
                }
            } catch {
                if (!cancelled) toast.error('Could not load AI settings')
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const refreshOpenRouterData = async () => {
        setOrLoading(true)
        try {
            const [modelsRes, imageModelsRes, balanceRes] = await Promise.all([
                fetch('/api/admin/openrouter/models?output_modalities=all'),
                fetch('/api/admin/openrouter/models?output_modalities=image'),
                fetch('/api/admin/openrouter/balance'),
            ])
            const modelsJson = await modelsRes.json().catch(() => ({}))
            const imageModelsJson = await imageModelsRes.json().catch(() => ({}))
            const balanceJson = await balanceRes.json().catch(() => ({}))
            if (Array.isArray(modelsJson?.models)) {
                setOpenrouterModels(
                    modelsJson.models
                        .map((m: any) => ({
                            id: String(m.id || ''),
                            name: String(m.name || m.id || ''),
                            context_length: Number(m.context_length || 0) || 0,
                        }))
                        .filter((m: ModelOption) => !!m.id)
                )
            }
            if (Array.isArray(imageModelsJson?.models)) {
                setOpenrouterImageModels(
                    imageModelsJson.models
                        .map((m: any) => ({
                            id: String(m.id || ''),
                            name: String(m.name || m.id || ''),
                            context_length: Number(m.context_length || 0) || 0,
                        }))
                        .filter((m: ModelOption) => !!m.id)
                )
            }
            if (!balanceJson?.error) {
                setBalance({
                    total_credits: Number(balanceJson.total_credits || 0),
                    total_usage: Number(balanceJson.total_usage || 0),
                })
            }
            toast.success('OpenRouter data refreshed')
        } catch (e) {
            toast.error((e as Error).message || 'Could not refresh OpenRouter data')
        } finally {
            setOrLoading(false)
        }
    }

    const save = async () => {
        setSaving(true)
        try {
            const body = {
                ai_primary_provider: provider,
                ai_primary_model: activeModel,
                ai_openrouter_model: openrouterModel,
                ai_openrouter_image_model: openrouterImageModel,
                ai_claude_model: claudeModel,
                ai_gemini_model: geminiModel,
            }
            const res = await fetch('/api/admin/platform-settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const json = await res.json()
            if (json?.error) {
                toast.error(json.error)
                return
            }
            setPrimaryModel(activeModel)
            toast.success('AI provider and model settings saved')
        } catch (e) {
            toast.error((e as Error).message || 'Could not save AI settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading AI settings…
                </CardContent>
            </Card>
        )
    }

    const showNvidiaHint =
        provider === 'openrouter' && (openrouterModel.toLowerCase().includes('nvidia') || openrouterModel.toLowerCase().includes('nemotron'))

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    Agentic AI Provider & Model
                </CardTitle>
                <CardDescription>
                    Choose the primary AI source for Agentic AI flows. OpenRouter, Claude, and Gemini stay available and can be switched anytime.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Primary provider</label>
                    <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as Provider)}
                        className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                        <option value="openrouter">OpenRouter (recommended primary)</option>
                        <option value="claude">Claude (Anthropic)</option>
                        <option value="gemini">Gemini (Google)</option>
                    </select>
                </div>

                {provider === 'openrouter' ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-sm font-medium">OpenRouter model</label>
                            <Button size="sm" variant="outline" onClick={refreshOpenRouterData} disabled={orLoading}>
                                {orLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                Refresh models & balance
                            </Button>
                        </div>
                        <select
                            value={openrouterModel}
                            onChange={(e) => setOpenrouterModel(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            {openrouterModels.length === 0 ? (
                                <option value={openrouterModel}>{openrouterModel}</option>
                            ) : (
                                openrouterModels.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.id}
                                    </option>
                                ))
                            )}
                        </select>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {showNvidiaHint ? (
                                <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                                    <img src="https://www.nvidia.com/favicon.ico" alt="NVIDIA" className="h-3.5 w-3.5" />
                                    NVIDIA model selected
                                </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">
                                <Wallet className="h-3.5 w-3.5" />
                                OpenRouter balance: {balance ? fmtUsd(balance.total_credits - balance.total_usage) : '—'}
                            </span>
                            <span>Total credits: {balance ? fmtUsd(balance.total_credits) : '—'}</span>
                            <span>Usage: {balance ? fmtUsd(balance.total_usage) : '—'}</span>
                        </div>
                    </div>
                ) : null}

                {provider === 'claude' ? (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Claude model</label>
                        <select
                            value={claudeModel}
                            onChange={(e) => setClaudeModel(e.target.value)}
                            className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            {CLAUDE_DEFAULTS.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>
                        <Input value={claudeModel} onChange={(e) => setClaudeModel(e.target.value)} placeholder="Custom Claude model id" />
                    </div>
                ) : null}

                {provider === 'gemini' ? (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Gemini model</label>
                        <select
                            value={geminiModel}
                            onChange={(e) => setGeminiModel(e.target.value)}
                            className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            {GEMINI_DEFAULTS.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>
                        <Input value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} placeholder="Custom Gemini model id" />
                    </div>
                ) : null}

                <div className="space-y-2 rounded-md border border-dashed p-4">
                    <label className="text-sm font-medium">E-invite image model (OpenRouter)</label>
                    <p className="text-xs text-muted-foreground">
                        Used by the mobile app AI invite studio. Requires an image-capable OpenRouter model (e.g. Riverflow v2 Fast).
                    </p>
                    <select
                        value={openrouterImageModel}
                        onChange={(e) => setOpenrouterImageModel(e.target.value)}
                        className="flex h-10 w-full max-w-2xl rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                        {imageModelOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.id}
                            </option>
                        ))}
                    </select>
                    <Input
                        value={openrouterImageModel}
                        onChange={(e) => setOpenrouterImageModel(e.target.value)}
                        placeholder="Custom OpenRouter image model id"
                    />
                </div>

                <div className="rounded-md border p-3 text-xs text-muted-foreground">
                    <div>Current primary model: {primaryModel || activeModel}</div>
                    <div>Next save will set primary to: {activeModel}</div>
                </div>

                <Button type="button" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save AI runtime settings
                </Button>
            </CardContent>
        </Card>
    )
}
