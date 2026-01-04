import { createClient } from '@/utils/supabase/client'

const BUCKET_NAME = 'ekatraa2025'

export async function uploadFile(
    file: File,
    folder: string = 'uploads',
    fileName?: string
): Promise<string | null> {
    try {
        const supabase = createClient()
        const fileExt = file.name.split('.').pop()
        const timestamp = Date.now()
        const randomString = Math.random().toString(36).substring(2, 15)
        const finalFileName = fileName || `${timestamp}-${randomString}.${fileExt}`
        const filePath = `${folder}/${finalFileName}`

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            })

        if (error) {
            console.error('Upload error:', error)
            return null
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath)

        return publicUrl
    } catch (error) {
        console.error('File upload error:', error)
        return null
    }
}

export async function uploadFileFromServer(
    file: File | Buffer,
    folder: string = 'uploads',
    fileName?: string,
    contentType?: string
): Promise<string | null> {
    try {
        const { supabase } = await import('@/lib/supabase/server')
        const fileExt = fileName?.split('.').pop() || 'bin'
        const timestamp = Date.now()
        const randomString = Math.random().toString(36).substring(2, 15)
        const finalFileName = fileName || `${timestamp}-${randomString}.${fileExt}`
        const filePath = `${folder}/${finalFileName}`

        // Determine content type
        let finalContentType: string | undefined = contentType
        if (!finalContentType && file instanceof File) {
            finalContentType = file.type
        }

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: finalContentType
            })

        if (error) {
            console.error('Upload error:', error)
            return null
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath)

        return publicUrl
    } catch (error) {
        console.error('File upload error:', error)
        return null
    }
}

export async function deleteFile(filePath: string): Promise<boolean> {
    try {
        const supabase = createClient()
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath])

        if (error) {
            console.error('Delete error:', error)
            return false
        }

        return true
    } catch (error) {
        console.error('File delete error:', error)
        return false
    }
}

