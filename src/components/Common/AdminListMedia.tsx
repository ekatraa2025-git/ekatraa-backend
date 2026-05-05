'use client'

import React, { useEffect, useState } from 'react'

const STORAGE_URL_PATTERN = /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/

function extractStoragePath(url: string): string {
    const match = url.match(STORAGE_URL_PATTERN)
    return match ? match[1] : url
}

function useSignedUrl(pathOrUrl: string | null | undefined): string | null {
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)

    useEffect(() => {
        if (!pathOrUrl) {
            setResolvedUrl(null)
            return
        }
        const storagePath = extractStoragePath(pathOrUrl)
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
    }, [pathOrUrl])

    return resolvedUrl
}

/**
 * Table/list thumbnail: prefers WebM/video over static image when both exist.
 */
export function AdminListMedia({
    videoUrl,
    imageUrl,
    alt = 'Media',
    className = 'h-10 w-14 rounded object-cover',
    placeholderClassName = 'h-10 w-14 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] text-gray-500',
}: {
    videoUrl?: string | null
    imageUrl?: string | null
    alt?: string
    className?: string
    placeholderClassName?: string
}) {
    const primaryPath = videoUrl?.trim() ? videoUrl : imageUrl?.trim() ? imageUrl : null
    const preferVideo = Boolean(videoUrl?.trim())
    const signed = useSignedUrl(primaryPath)

    if (!primaryPath) {
        return <div className={placeholderClassName}>—</div>
    }
    if (!signed) {
        return <div className={placeholderClassName}>Loading…</div>
    }
    if (preferVideo) {
        return (
            <video
                src={signed}
                className={className}
                muted
                playsInline
                loop
                autoPlay
                preload="metadata"
            />
        )
    }
    return <img src={signed} alt={alt} className={className} />
}
