import { supabase } from '@/lib/supabase/server'

const MAX_CONTEXT_CHARS = 2800
const CACHE_TTL_MS = 5 * 60 * 1000

type CacheEntry = { key: string; text: string; at: number }
let cache: CacheEntry | null = null

function one<T>(x: T | T[] | null | undefined): T | null {
    if (x == null) return null
    return Array.isArray(x) ? (x[0] ?? null) : x
}

function truncate(s: string, max: number): string {
    if (s.length <= max) return s
    return `${s.slice(0, max - 1)}…`
}

/**
 * Compact snapshot of occasions, linked categories, and sample service names from Supabase.
 * Used in AI system prompts so the model suggests real Ekatraa catalog items.
 */
export async function getAiAppCatalogContext(opts: {
    city?: string | null
    occasion_id?: string | null
} = {}): Promise<string> {
    const city = typeof opts.city === 'string' ? opts.city.trim() : ''
    const focusOccasionId = typeof opts.occasion_id === 'string' ? opts.occasion_id.trim() : ''
    const cacheKey = `${city}|${focusOccasionId}`
    if (cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
        return cache.text
    }

    const lines: string[] = [
        'EKATRAA APP CATALOG (from our live database — when you mention occasions, spending areas, or services, prefer names from this list; do not invent vendor brands):',
        '',
    ]

    const { data: ocCats, error: ocErr } = await supabase
        .from('occasion_categories')
        .select('occasion_id, display_order, occasions(id, name), categories(name)')
        .order('display_order', { ascending: true })

    if (ocErr || !ocCats?.length) {
        const { data: occs } = await supabase
            .from('occasions')
            .select('name')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .limit(16)
        const names = (occs ?? []).map((o: { name: string }) => o.name).filter(Boolean)
        if (names.length) {
            lines.push('Active occasions:', ...names.map((n) => `- ${n}`))
        } else {
            lines.push('(Occasion linkage unavailable — still guide the user to browse occasions in the app.)')
        }
    } else {
        const byOcc = new Map<string, { name: string; minOrder: number; cats: string[] }>()
        for (const row of ocCats as {
            occasion_id: string
            display_order?: number | null
            occasions?: { id: string; name: string } | { id: string; name: string }[] | null
            categories?: { name: string } | { name: string }[] | null
        }[]) {
            const oid = row.occasion_id
            const oname = one(row.occasions)?.name ?? 'Occasion'
            const ord = typeof row.display_order === 'number' ? row.display_order : 999
            const catName = one(row.categories)?.name
            if (!byOcc.has(oid)) {
                byOcc.set(oid, { name: oname, minOrder: ord, cats: [] })
            } else {
                byOcc.get(oid)!.minOrder = Math.min(byOcc.get(oid)!.minOrder, ord)
            }
            if (catName) {
                const g = byOcc.get(oid)!
                if (!g.cats.includes(catName)) g.cats.push(catName)
            }
        }
        let rows = [...byOcc.entries()].map(([id, v]) => ({ id, ...v }))
        rows.sort((a, b) => a.minOrder - b.minOrder)
        if (focusOccasionId) {
            const i = rows.findIndex((r) => r.id === focusOccasionId)
            if (i > 0) {
                const [picked] = rows.splice(i, 1)
                rows = [picked, ...rows]
            }
        }
        lines.push('Occasions and category areas in the app:')
        for (const r of rows.slice(0, 12)) {
            const cats = r.cats.slice(0, 14).join(', ')
            lines.push(`- ${r.name}${cats ? `: ${cats}` : ''}`)
        }
    }

    let svcQuery = supabase
        .from('offerable_services')
        .select('name')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(180)

    if (city) {
        svcQuery = svcQuery.eq('city', city)
    }

    const { data: svcs } = await svcQuery
    const names = [...new Set((svcs ?? []).map((s: { name: string }) => s.name).filter(Boolean))].slice(0,50)

    lines.push('')
    if (names.length) {
        lines.push(
            `Example services users can explore${city ? ` in ${city}` : ''} (${names.length} sample names): ${names.join(', ')}.`
        )
    } else {
        lines.push(
            city
                ? `No active service names returned for city "${city}" in this snapshot — suggest browsing Services in the app for their city.`
                : 'Browse Services in the Ekatraa app for current packages and prices.'
        )
    }

    const text = truncate(lines.join('\n'), MAX_CONTEXT_CHARS)
    cache = { key: cacheKey, text, at: Date.now() }
    return text
}
