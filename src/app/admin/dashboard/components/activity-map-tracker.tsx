'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MapPin, RefreshCw, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LayerGroup, LatLngTuple, Map as LeafletMap } from 'leaflet'

type LeafletNamespace = typeof import('leaflet')

type VendorMarker = {
    id: string
    name: string
    lat: number
    lng: number
    city: string | null
    activity: 'no_allocation' | 'allocated' | 'in_progress' | 'finishing_work' | 'available'
}

type CustomerMarker = {
    id: string
    name: string
    lat: number
    lng: number
    cityHint: string | null
}

type LinkRow = {
    orderId: string
    vendorId: string
    userId: string
    orderStatus: string
    serviceLabel: string
    distanceKm: number
    isNearestForCustomer: boolean
}

type TrackingPayload = {
    updatedAt: string
    vendors: VendorMarker[]
    customers: CustomerMarker[]
    links: LinkRow[]
}

const VENDOR_ACTIVITY: Record<
    VendorMarker['activity'],
    { label: string; color: string; ring: string }
> = {
    no_allocation: { label: 'No active allocation', color: '#64748b', ring: 'rgba(100,116,139,0.35)' },
    allocated: { label: 'Allocated / confirmed', color: '#2563eb', ring: 'rgba(37,99,235,0.35)' },
    in_progress: { label: 'Work in progress', color: '#ea580c', ring: 'rgba(234,88,12,0.35)' },
    finishing_work: { label: 'Finishing (completion OTP)', color: '#ca8a04', ring: 'rgba(202,138,4,0.35)' },
    available: { label: 'Available / between jobs', color: '#16a34a', ring: 'rgba(22,163,74,0.35)' },
}

const CUSTOMER_COLOR = '#9333ea'

let leafletPromise: Promise<void> | null = null

function getLeafletNamespace(): LeafletNamespace {
    if (typeof window === 'undefined') {
        throw new Error('Leaflet is only available in the browser')
    }
    const L = (window as Window & { L?: LeafletNamespace }).L
    if (!L) {
        throw new Error('Leaflet not loaded')
    }
    return L
}

function ensureLeaflet(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    const w = window as Window & { L?: LeafletNamespace }
    if (w.L) return Promise.resolve()
    if (!leafletPromise) {
        leafletPromise = new Promise((resolve, reject) => {
            if (!document.querySelector('link[data-leaflet-css]')) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
                link.setAttribute('data-leaflet-css', '1')
                document.head.appendChild(link)
            }
            const s = document.createElement('script')
            s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
            s.async = true
            s.setAttribute('data-leaflet-js', '1')
            s.onload = () => resolve()
            s.onerror = () => reject(new Error('Leaflet script failed'))
            document.body.appendChild(s)
        })
    }
    return leafletPromise
}

function vendorDivHtml(name: string, meta: (typeof VENDOR_ACTIVITY)[VendorMarker['activity']]) {
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;transform:translate(-50%,-100%);">
      <div style="background:${meta.color};color:#fff;padding:4px 10px;border-radius:10px;font-size:11px;font-weight:800;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35);max-width:200px;text-overflow:ellipsis;overflow:hidden;">
        ${escapeHtml(name)}
      </div>
      <span style="font-size:9px;font-weight:700;color:${meta.color};text-shadow:0 0 4px #fff;">Vendor</span>
    </div>`
}

function customerDivHtml(name: string) {
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;transform:translate(-50%,-100%);">
      <div style="background:${CUSTOMER_COLOR};color:#fff;padding:4px 10px;border-radius:10px;font-size:11px;font-weight:800;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35);max-width:200px;text-overflow:ellipsis;overflow:hidden;">
        ${escapeHtml(name)}
      </div>
      <span style="font-size:9px;font-weight:700;color:${CUSTOMER_COLOR};text-shadow:0 0 4px #fff;">Customer</span>
    </div>`
}

function escapeHtml(s: string) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function parseTrackingPayload(json: unknown): TrackingPayload {
    if (!json || typeof json !== 'object') {
        throw new Error('Invalid response')
    }
    const o = json as Record<string, unknown>
    if (
        typeof o.updatedAt !== 'string' ||
        !Array.isArray(o.vendors) ||
        !Array.isArray(o.customers) ||
        !Array.isArray(o.links)
    ) {
        throw new Error('Invalid map payload')
    }
    return {
        updatedAt: o.updatedAt,
        vendors: o.vendors as VendorMarker[],
        customers: o.customers as CustomerMarker[],
        links: o.links as LinkRow[],
    }
}

export function ActivityMapTracker() {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<LeafletMap | null>(null)
    const groupRef = useRef<LayerGroup | null>(null)
    const [payload, setPayload] = useState<TrackingPayload | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/tracking-map', { cache: 'no-store' })
            const json: unknown = await res.json()
            if (!res.ok) {
                const err = json && typeof json === 'object' && 'error' in json ? String((json as { error?: unknown }).error) : res.statusText
                throw new Error(err)
            }
            setPayload(parseTrackingPayload(json))
            setLoadError(null)
        } catch (e: unknown) {
            setLoadError(e instanceof Error ? e.message : 'Failed to load map data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
        const id = setInterval(fetchData, 12000)
        return () => clearInterval(id)
    }, [fetchData])

    useEffect(() => {
        if (!payload || !containerRef.current) return
        let cancelled = false

        const run = async () => {
            try {
                await ensureLeaflet()
            } catch {
                setLoadError('Map library could not load.')
                return
            }
            if (cancelled || !containerRef.current) return

            const L = getLeafletNamespace()
            const el = containerRef.current

            if (!mapRef.current) {
                const map = L.map(el).setView([20.5937, 78.9629], 5)
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                }).addTo(map)
                const g = L.layerGroup().addTo(map)
                groupRef.current = g
                mapRef.current = map
                setTimeout(() => {
                    map.invalidateSize()
                }, 300)
            }

            const map = mapRef.current
            const group = groupRef.current
            if (!map || !group) return

            group.clearLayers()

            const bounds: LatLngTuple[] = []

            for (const v of payload.vendors) {
                const meta = VENDOR_ACTIVITY[v.activity]
                const icon = L.divIcon({
                    className: 'ek-map-marker',
                    html: vendorDivHtml(v.name, meta),
                    iconSize: [0, 0],
                    iconAnchor: [0, 0],
                })
                const m = L.marker([v.lat, v.lng], { icon })
                m.bindPopup(
                    `<div style="min-width:200px"><strong>${escapeHtml(v.name)}</strong><br/><span style="color:${meta.color};font-weight:700">${meta.label}</span>${v.city ? `<br/>City: ${escapeHtml(v.city)}` : ''}</div>`
                )
                group.addLayer(m)
                bounds.push([v.lat, v.lng])
            }

            for (const c of payload.customers) {
                const icon = L.divIcon({
                    className: 'ek-map-marker',
                    html: customerDivHtml(c.name),
                    iconSize: [0, 0],
                    iconAnchor: [0, 0],
                })
                const m = L.marker([c.lat, c.lng], { icon })
                m.bindPopup(
                    `<div style="min-width:200px"><strong>${escapeHtml(c.name)}</strong><br/><span style="color:${CUSTOMER_COLOR};font-weight:700">Ekatraa customer</span>${c.cityHint ? `<br/><small>${escapeHtml(c.cityHint)}</small>` : ''}</div>`
                )
                group.addLayer(m)
                bounds.push([c.lat, c.lng])
            }

            for (const l of payload.links) {
                const v = payload.vendors.find((x) => x.id === l.vendorId)
                const c = payload.customers.find((x) => x.id === l.userId)
                if (!v || !c) continue
                const near = l.isNearestForCustomer
                const line = L.polyline(
                    [
                        [v.lat, v.lng],
                        [c.lat, c.lng],
                    ],
                    {
                        color: near ? '#9333ea' : '#94a3b8',
                        weight: near ? 4 : 2,
                        opacity: near ? 0.95 : 0.55,
                        dashArray: near ? undefined : '8 6',
                    }
                )
                line.bindPopup(
                    `<div style="min-width:180px"><strong>${escapeHtml(l.serviceLabel)}</strong><br/>Order: <code>${escapeHtml(l.orderId.slice(0, 8))}…</code><br/>Status: ${escapeHtml(l.orderStatus)}<br/>~${l.distanceKm} km apart${near ? '<br/><em>Closest vendor for this customer</em>' : ''}</div>`
                )
                group.addLayer(line)
            }

            if (bounds.length > 0) {
                map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 })
            }
        }

        run()
        return () => {
            cancelled = true
        }
    }, [payload])

    useEffect(() => {
        return () => {
            const m = mapRef.current
            if (m) {
                m.remove()
            }
            mapRef.current = null
            groupRef.current = null
        }
    }, [])

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-lg font-semibold">
                        <Radio className="h-5 w-5 text-primary" />
                        Live activity map
                    </div>
                    <p className="text-sm text-muted-foreground max-w-3xl">
                        Vendors and customers are positioned from city / venue text (approximate). Colors show workload.
                        Lines connect allocated orders; purple highlights the closest vendor–customer pair by distance.
                        Refreshes every 12s.
                    </p>
                    {payload?.updatedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Last update: {new Date(payload.updatedAt).toLocaleString()}
                        </p>
                    )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => { setLoading(true); fetchData(); }} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh now
                </Button>
            </div>

            {loadError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    {loadError}
                </div>
            )}

            <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5" style={{ borderColor: VENDOR_ACTIVITY.no_allocation.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: VENDOR_ACTIVITY.no_allocation.color }} />
                    Vendor: no allocation
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5" style={{ borderColor: VENDOR_ACTIVITY.allocated.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: VENDOR_ACTIVITY.allocated.color }} />
                    Allocated
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5" style={{ borderColor: VENDOR_ACTIVITY.in_progress.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: VENDOR_ACTIVITY.in_progress.color }} />
                    In progress
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5" style={{ borderColor: VENDOR_ACTIVITY.finishing_work.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: VENDOR_ACTIVITY.finishing_work.color }} />
                    Finishing
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5" style={{ borderColor: VENDOR_ACTIVITY.available.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: VENDOR_ACTIVITY.available.color }} />
                    Available
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 border-purple-600">
                    <span className="h-2 w-2 rounded-full bg-purple-600" />
                    Customer
                </span>
            </div>

            <div className="relative overflow-hidden rounded-xl border bg-muted/30">
                <div ref={containerRef} className="h-[min(520px,70vh)] w-full z-0" />
                {!payload && !loadError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
                        <MapPin className="h-5 w-5 mr-2 animate-pulse" />
                        Loading map…
                    </div>
                )}
            </div>
        </div>
    )
}
