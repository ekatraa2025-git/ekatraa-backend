import { supabase } from '@/lib/supabase/server'

const BUCKET = 'ekatraa2025'
const SIGNED_SEC = 3600

/**
 * Returns a time-limited signed URL so images load in browsers/apps even when the bucket is not public.
 * Accepts a storage path (e.g. testimonials/abc.png) or a full Supabase storage URL (path is extracted).
 */
export async function signedUrlForStorageRef(raw: string | null | undefined): Promise<string | null> {
    if (!raw || typeof raw !== 'string') return null
    const s = raw.trim()
    if (!s) return null

    if (s.startsWith('http://') || s.startsWith('https://')) {
        if (s.includes('token=')) return s

        const m = s.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/[^/]+\/(.+?)(?:\?|$)/i)
        if (m?.[1]) {
            const path = decodeURIComponent(m[1].replace(/\+/g, ' '))
            const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_SEC)
            if (!error && data?.signedUrl) return data.signedUrl
        }
        const m2 = s.match(/\/ekatraa2025\/(.+?)(?:\?|$)/i)
        if (m2?.[1]) {
            const path = decodeURIComponent(m2[1].replace(/\+/g, ' '))
            const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_SEC)
            if (!error && data?.signedUrl) return data.signedUrl
        }
        return s
    }

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(s, SIGNED_SEC)
    if (!error && data?.signedUrl) return data.signedUrl
    return null
}
