import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { haversineKm, resolveLatLngFromLocation } from '@/lib/tracking-map-coords'

export const dynamic = 'force-dynamic'

type VendorActivity =
    | 'no_allocation'
    | 'allocated'
    | 'in_progress'
    | 'finishing_work'
    | 'available'

/**
 * GET /api/admin/tracking-map
 * Aggregates vendors, customers (order owners), allocations, and proximity for the admin activity map.
 * Coordinates are approximated from city / location text when GPS is not stored.
 */
export async function GET() {
    try {
        const { data: vendors, error: vErr } = await supabase.from('vendors').select('*').order('business_name', { ascending: true })
        if (vErr) {
            return NextResponse.json({ error: vErr.message }, { status: 500 })
        }

        const { data: orders, error: oErr } = await supabase
            .from('orders')
            .select(
                'id, user_id, vendor_id, status, contact_name, location_preference, venue_preference, event_name, work_started_at, work_completed_at, created_at'
            )
            .order('created_at', { ascending: false })
        if (oErr) {
            return NextResponse.json({ error: oErr.message }, { status: 500 })
        }

        const orderList = orders ?? []
        const orderIds = orderList.map((o) => o.id as string)

        let itemRows: { id: string; order_id: string; name?: string }[] = []
        if (orderIds.length > 0) {
            const { data: items } = await supabase.from('order_items').select('id, order_id, name').in('order_id', orderIds)
            itemRows = (items ?? []) as { id: string; order_id: string; name?: string }[]
        }

        const itemToOrder = new Map<string, string>()
        const firstItemNameByOrder = new Map<string, string>()
        for (const it of itemRows) {
            const oid = it.order_id
            const iid = it.id
            itemToOrder.set(iid, oid)
            if (!firstItemNameByOrder.has(oid)) {
                firstItemNameByOrder.set(oid, String(it.name || 'Service'))
            }
        }

        let completionOtpOrderIds = new Set<string>()
        if (orderIds.length) {
            const { data: cotp } = await supabase.from('order_completion_otp').select('order_id')
            for (const row of cotp ?? []) {
                completionOtpOrderIds.add((row as { order_id: string }).order_id)
            }
        }

        let allocationsByOrderId = new Map<string, { vendor_id: string }[]>()
        const itemIds = itemRows.map((i) => i.id)
        if (itemIds.length) {
            const { data: allocs } = await supabase.from('order_item_allocations').select('order_item_id, vendor_id').in('order_item_id', itemIds)
            for (const a of allocs ?? []) {
                const oid = itemToOrder.get((a as { order_item_id: string }).order_item_id)
                if (!oid) continue
                const list = allocationsByOrderId.get(oid) ?? []
                list.push({ vendor_id: (a as { vendor_id: string }).vendor_id })
                allocationsByOrderId.set(oid, list)
            }
        }

        const activeStatuses = new Set(['pending', 'allocated', 'confirmed', 'in_progress'])

        function vendorsForOrder(o: { id: string; vendor_id?: string | null }): string[] {
            const set = new Set<string>()
            if (o.vendor_id) set.add(o.vendor_id as string)
            for (const a of allocationsByOrderId.get(o.id) ?? []) {
                set.add(a.vendor_id)
            }
            return [...set]
        }

        const vendorIds = new Set<string>((vendors ?? []).map((v: { id: string }) => v.id))

        const vendorOrderBuckets = new Map<
            string,
            { active: typeof orderList; completedOnly: number }
        >()
        for (const vid of vendorIds) {
            vendorOrderBuckets.set(vid, { active: [], completedOnly: 0 })
        }

        for (const o of orderList) {
            const vids = vendorsForOrder(o)
            const st = String(o.status || '').toLowerCase()
            for (const vid of vids) {
                if (!vendorOrderBuckets.has(vid)) continue
                const b = vendorOrderBuckets.get(vid)!
                if (activeStatuses.has(st) && st !== 'cancelled') {
                    b.active.push(o)
                } else if (st === 'completed') {
                    b.completedOnly += 1
                }
            }
        }

        function vendorActivity(vid: string): VendorActivity {
            const b = vendorOrderBuckets.get(vid) ?? { active: [], completedOnly: 0 }
            const active = b.active
            if (active.length === 0) {
                return b.completedOnly > 0 ? 'available' : 'no_allocation'
            }
            const inProg = active.filter((x) => String(x.status || '').toLowerCase() === 'in_progress')
            if (inProg.length) {
                const finishing = inProg.some((o) => completionOtpOrderIds.has(o.id as string))
                return finishing ? 'finishing_work' : 'in_progress'
            }
            const allocated = active.some((x) => {
                const s = String(x.status || '').toLowerCase()
                return s === 'confirmed' || s === 'pending' || s === 'allocated'
            })
            if (allocated) return 'allocated'
            return 'allocated'
        }

        const vendorMarkers = (vendors ?? []).map((v: Record<string, unknown>) => {
            const id = v.id as string
            const city = (v.city as string) || null
            const addr = (v.address as string) || null
            const pos = resolveLatLngFromLocation(city, addr, `v-${id}`)
            return {
                id,
                name: String(v.business_name || 'Vendor'),
                lat: pos.lat,
                lng: pos.lng,
                city: city || null,
                activity: vendorActivity(id),
            }
        })

        const userIds = [...new Set(orderList.map((o) => o.user_id).filter(Boolean) as string[])]
        const customerByUserId = new Map<
            string,
            { label: string; lat: number; lng: number; cityHint: string | null }
        >()

        for (const uid of userIds) {
            const userOrders = orderList.filter((o) => o.user_id === uid)
            const latest = userOrders[0]
            const label =
                String(latest?.contact_name || '').trim() ||
                `Customer ${uid.slice(0, 8)}`
            const pref = [latest?.venue_preference, latest?.location_preference].filter(Boolean).join(', ')
            const pos = resolveLatLngFromLocation(null, pref || null, `u-${uid}`)
            customerByUserId.set(uid, {
                label,
                lat: pos.lat,
                lng: pos.lng,
                cityHint: pref ? pref.slice(0, 80) : null,
            })
        }

        const customers = userIds.map((uid) => {
            const c = customerByUserId.get(uid)!
            return {
                id: uid,
                name: c.label,
                lat: c.lat,
                lng: c.lng,
                cityHint: c.cityHint,
            }
        })

        type LinkRow = {
            orderId: string
            vendorId: string
            userId: string
            orderStatus: string
            serviceLabel: string
            distanceKm: number
            isNearestForCustomer: boolean
        }

        const links: LinkRow[] = []
        for (const o of orderList) {
            if (!activeStatuses.has(String(o.status || '').toLowerCase())) continue
            if (String(o.status || '').toLowerCase() === 'cancelled') continue
            const uid = o.user_id as string
            if (!uid) continue
            const vids = vendorsForOrder(o)
            const cust = customerByUserId.get(uid)
            if (!cust) continue
            for (const vid of vids) {
                const vm = vendorMarkers.find((x) => x.id === vid)
                if (!vm) continue
                const d = haversineKm({ lat: vm.lat, lng: vm.lng }, { lat: cust.lat, lng: cust.lng })
                links.push({
                    orderId: o.id as string,
                    vendorId: vid,
                    userId: uid,
                    orderStatus: String(o.status || ''),
                    serviceLabel: firstItemNameByOrder.get(o.id as string) || 'Order',
                    distanceKm: Math.round(d * 10) / 10,
                    isNearestForCustomer: false,
                })
            }
        }

        const nearestByUser = new Map<string, LinkRow>()
        for (const l of links) {
            const prev = nearestByUser.get(l.userId)
            if (!prev || l.distanceKm < prev.distanceKm) {
                nearestByUser.set(l.userId, l)
            }
        }
        nearestByUser.forEach((best) => {
            const found = links.find(
                (x) =>
                    x.userId === best.userId &&
                    x.orderId === best.orderId &&
                    x.vendorId === best.vendorId &&
                    x.distanceKm === best.distanceKm
            )
            if (found) found.isNearestForCustomer = true
        })

        return NextResponse.json({
            updatedAt: new Date().toISOString(),
            vendors: vendorMarkers,
            customers,
            links,
        })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Server error'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
