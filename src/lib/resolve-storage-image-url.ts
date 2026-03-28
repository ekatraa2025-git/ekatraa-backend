import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'ekatraa2025'

/**
 * Returns a usable HTTP URL for an image: passes through full URLs, otherwise signed URL for storage path.
 */
export async function resolveStorageImageUrl(
    supabase: SupabaseClient,
    pathOrUrl: string | null | undefined,
    expiresIn = 3600
): Promise<string | null> {
    if (pathOrUrl == null || typeof pathOrUrl !== 'string') return null
    const t = pathOrUrl.trim()
    if (!t) return null
    if (t.startsWith('http://') || t.startsWith('https://')) return t
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(t, expiresIn)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
}
