'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'

export default function BookingProtectionSettings() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [mode, setMode] = useState<'none' | 'fixed' | 'percent'>('none')
    const [fixedInr, setFixedInr] = useState(0)
    const [percentVal, setPercentVal] = useState(0)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch('/api/admin/platform-settings')
                const d = await res.json()
                if (!cancelled && d && !d.error) {
                    const m = d.booking_protection_mode
                    if (m === 'fixed' || m === 'percent' || m === 'none') setMode(m)
                    setFixedInr(Number(d.booking_protection_fixed_inr ?? 0))
                    setPercentVal(Number(d.booking_protection_percent ?? 0))
                }
            } catch {
                if (!cancelled) toast.error('Could not load platform settings')
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const save = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/platform-settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_protection_mode: mode,
                    booking_protection_fixed_inr: fixedInr,
                    booking_protection_percent: percentVal,
                }),
            })
            const data = await res.json()
            if (data?.error) toast.error(data.error)
            else toast.success('Booking protection settings saved')
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading settings…
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Booking protection (checkout)
                </CardTitle>
                <CardDescription>
                    Set to <strong>none</strong> for ₹0 add-on, <strong>fixed</strong> for a flat INR fee, or <strong>percent</strong> of
                    cart subtotal. The fee is added to the order total; the 20% advance is calculated on services + protection.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="bp-mode" className="text-sm font-medium">
                        Pricing mode
                    </label>
                    <select
                        id="bp-mode"
                        value={mode}
                        onChange={(e) => setMode(e.target.value as 'none' | 'fixed' | 'percent')}
                        className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <option value="none">None (no charge)</option>
                        <option value="fixed">Fixed (INR)</option>
                        <option value="percent">Percent of cart subtotal</option>
                    </select>
                </div>
                {mode === 'fixed' && (
                    <div className="space-y-2">
                        <label htmlFor="bp-fixed" className="text-sm font-medium">
                            Fixed amount (INR)
                        </label>
                        <Input
                            id="bp-fixed"
                            type="number"
                            min={0}
                            value={fixedInr}
                            onChange={(e) => setFixedInr(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        />
                    </div>
                )}
                {mode === 'percent' && (
                    <div className="space-y-2">
                        <label htmlFor="bp-pct" className="text-sm font-medium">
                            Percent (0–100)
                        </label>
                        <Input
                            id="bp-pct"
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={percentVal}
                            onChange={(e) => setPercentVal(Number(e.target.value) || 0)}
                        />
                    </div>
                )}
                <Button type="button" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save protection pricing
                </Button>
            </CardContent>
        </Card>
    )
}
