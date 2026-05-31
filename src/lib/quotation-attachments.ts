import { signedUrlForStorageRef } from '@/lib/storage-display-url'

/** Sign attachment URLs for client display (mobile app / web). */
export async function signQuotationAttachments(
    attachments: unknown
): Promise<Record<string, string[]>> {
    if (!attachments || typeof attachments !== 'object' || Array.isArray(attachments)) {
        return {}
    }
    const result: Record<string, string[]> = {}
    for (const [category, urls] of Object.entries(attachments as Record<string, unknown>)) {
        if (!Array.isArray(urls)) continue
        result[category] = await Promise.all(
            urls.map(async (url: unknown) => {
                const raw = typeof url === 'string' ? url : ''
                const signed = await signedUrlForStorageRef(raw)
                return signed ?? raw
            })
        )
    }
    return result
}
