'use client'

import React, { useEffect, useState } from 'react'

const STORAGE_URL_PATTERN = /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/

function extractStoragePath(url: string): string {
    const match = url.match(STORAGE_URL_PATTERN)
    return match ? match[1] : url
}

/**
 * Renders an image from Supabase storage using signed URLs.
 * Accepts either a storage path (e.g. "catalog-categories/img.png")
 * or a full Supabase public URL (extracts the path and fetches a signed URL).
 */
export function AdminImage({
    url,
    alt,
    className,
    placeholderClassName,
}: {
    url: string | null | undefined
    alt: string
    className?: string
    placeholderClassName?: string
}) {
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)

    useEffect(() => {
        if (!url) {
            setResolvedUrl(null)
            return
        }
        const storagePath = extractStoragePath(url)
        let cancelled = false
        fetch(`/api/admin/storage/signed-url?path=${encodeURIComponent(storagePath)}`)
            .then((res) => res.json())
            .then((data) => {
                if (!cancelled && data?.url) setResolvedUrl(data.url)
            })
            .catch(() => {
                if (!cancelled) setResolvedUrl(null)
            })
        return () => {
            cancelled = true
        }
    }, [url])

    if (!url)
        return (
            <div
                className={
                    placeholderClassName ||
                    'h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs'
                }
            >
                No img
            </div>
        )
    if (!resolvedUrl)
        return (
            <div
                className={
                    placeholderClassName ||
                    'h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs'
                }
            >
                Loading…
            </div>
        )
    return <img src={resolvedUrl} alt={alt} className={className} />
}
