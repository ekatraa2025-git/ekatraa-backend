'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { uploadFile } from '@/utils/storage'
import { AdminImage } from '@/components/Common/AdminImage'
import { RichTextEditor } from '@/components/Common/RichTextEditor'
import { Switch } from '@/components/ui/switch'

interface Field {
    name: string;
    label: string;
    type: 'text' | 'email' | 'password' | 'select' | 'textarea' | 'number' | 'checkbox' | 'file' | 'files' | 'switch' | 'richtext';
    options?: { label: string; value: any }[];
    placeholder?: string;
    required?: boolean;
    accept?: string;
    uploadFolder?: string;
    initialValue?: any;
    switchLabels?: { on: string; off: string };
}

interface FormProps {
    fields: Field[];
    onSubmit: (data: any) => Promise<void>;
    initialData?: any;
    title: string;
    loading?: boolean;
}

const Form = ({ fields, onSubmit, initialData = {}, title, loading }: FormProps) => {
    // Helper function to merge initialData with field initialValues
    const mergeInitialData = React.useMemo(() => {
        return (data: any) => {
            const merged = { ...data }
            fields.forEach(field => {
                if (field.initialValue !== undefined && merged[field.name] === undefined) {
                    merged[field.name] = field.initialValue
                }
            })
            return merged
        }
    }, [fields])

    // Initialize form data
    const [formData, setFormData] = React.useState(() => mergeInitialData(initialData))
    const [uploading, setUploading] = React.useState<Record<string, boolean>>({})
    const prevInitialDataRef = React.useRef<any>(initialData)
    const isInitialMount = React.useRef(true)

    // Sync formData when initialData changes (only if it's actually different)
    React.useEffect(() => {
        // Skip on initial mount since we already set it in useState
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }

        // Only update if initialData reference changed or content changed
        if (prevInitialDataRef.current !== initialData) {
            const currentKeys = Object.keys(initialData).sort().join(',')
            const prevKeys = Object.keys(prevInitialDataRef.current || {}).sort().join(',')
            
            // Check if keys changed or if any value changed
            if (currentKeys !== prevKeys) {
                setFormData(mergeInitialData(initialData))
                prevInitialDataRef.current = initialData
            } else {
                // Deep check for value changes
                let hasChanged = false
                for (const key in initialData) {
                    if (initialData[key] !== prevInitialDataRef.current[key]) {
                        hasChanged = true
                        break
                    }
                }
                if (hasChanged) {
                    setFormData(mergeInitialData(initialData))
                    prevInitialDataRef.current = initialData
                }
            }
        }
    }, [initialData, mergeInitialData])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target
        const val = (e.target as HTMLInputElement).type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        setFormData((prev: any) => ({ ...prev, [name]: val }))
    }

    const handleSwitchChange = (name: string, checked: boolean) => {
        setFormData((prev: any) => ({ ...prev, [name]: checked }))
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name } = e.target
        const file = e.target.files?.[0]
        if (!file) return

        const field = fields.find(f => f.name === name)
        if (!field || field.type !== 'file') return

        setUploading(prev => ({ ...prev, [name]: true }))
        
        try {
            const folder = field.uploadFolder || 'uploads'
            const url = await uploadFile(file, folder)
            
            if (url) {
                setFormData((prev: any) => ({ ...prev, [name]: url }))
            } else {
                alert(`Failed to upload ${field.label}. Please try again.`)
            }
        } catch (error) {
            console.error('File upload error:', error)
            alert(`Failed to upload ${field.label}. Please try again.`)
        } finally {
            setUploading(prev => ({ ...prev, [name]: false }))
        }
    }

    const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name } = e.target
        const files = e.target.files ? Array.from(e.target.files) : []
        if (!files.length) return

        const field = fields.find(f => f.name === name)
        if (!field || field.type !== 'files') return

        const current = Array.isArray(formData[name]) ? formData[name] : []
        const remaining = Math.max(0, 12 - current.length)
        if (remaining <= 0) {
            alert('Maximum 12 images allowed.')
            e.target.value = ''
            return
        }

        setUploading(prev => ({ ...prev, [name]: true }))
        try {
            const folder = field.uploadFolder || 'uploads'
            const uploadTargets = files.slice(0, remaining)
            const uploaded: string[] = []
            for (const file of uploadTargets) {
                const url = await uploadFile(file, folder)
                if (url) uploaded.push(url)
            }

            if (uploaded.length) {
                setFormData((prev: any) => ({ ...prev, [name]: [...current, ...uploaded].slice(0, 12) }))
            } else {
                alert(`Failed to upload ${field.label}. Please try again.`)
            }
        } catch (error) {
            console.error('Files upload error:', error)
            alert(`Failed to upload ${field.label}. Please try again.`)
        } finally {
            setUploading(prev => ({ ...prev, [name]: false }))
            e.target.value = ''
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await onSubmit(formData)
    }

    return (
        <div className="rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark">
            <div className="border-b border-stroke px-6 py-5 dark:border-strokedark bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-boxdark">
                <h3 className="text-lg font-semibold text-black dark:text-white">{title}</h3>
            </div>
            <form onSubmit={handleSubmit}>
                <div className="p-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {fields.map((field) => (
                            <div key={field.name} className={field.type === 'textarea' || field.type === 'checkbox' || field.type === 'switch' || field.type === 'richtext' || field.type === 'files' ? 'md:col-span-2' : ''}>
                                <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                    {field.label} {field.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                {field.type === 'switch' ? (
                                    <div className="flex items-center space-x-3 rounded-lg border border-stroke bg-gray-50 px-4 py-3 dark:border-strokedark dark:bg-gray-900">
                                        <Switch
                                            checked={formData[field.name] || false}
                                            onCheckedChange={(checked) => handleSwitchChange(field.name, checked)}
                                            name={field.name}
                                        />
                                        <span className="text-sm font-medium text-black dark:text-white">
                                            {formData[field.name] 
                                                ? (field.switchLabels?.on || 'Active') 
                                                : (field.switchLabels?.off || 'Inactive')}
                                        </span>
                                    </div>
                                ) : field.type === 'select' ? (
                                    <select
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={handleChange}
                                        required={field.required}
                                        className="w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-medium text-black shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                    >
                                        <option value="">Select {field.label}</option>
                                        {field.options?.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : field.type === 'textarea' ? (
                                    <textarea
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={handleChange}
                                        rows={4}
                                        placeholder={field.placeholder}
                                        required={field.required}
                                        className="w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-medium text-black shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                    ></textarea>
                                ) : field.type === 'checkbox' ? (
                                    <div className="flex items-center space-x-3 rounded-lg border border-stroke bg-gray-50 px-4 py-3 dark:border-strokedark dark:bg-gray-900">
                                        <Switch
                                            checked={formData[field.name] || false}
                                            onCheckedChange={(checked) => handleSwitchChange(field.name, checked)}
                                            name={field.name}
                                        />
                                        <span className="text-sm font-medium text-black dark:text-white">
                                            {formData[field.name] ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                ) : field.type === 'richtext' ? (
                                    <RichTextEditor
                                        value={formData[field.name] || ''}
                                        onChange={(html) => setFormData((prev: any) => ({ ...prev, [field.name]: html }))}
                                        placeholder={field.placeholder}
                                        minHeight="140px"
                                    />
                                ) : field.type === 'file' ? (
                                    <div>
                                        <input
                                            type="file"
                                            name={field.name}
                                            onChange={handleFileChange}
                                            accept={field.accept}
                                            required={field.required && !formData[field.name]}
                                            disabled={uploading[field.name]}
                                            className="w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-medium text-black shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                        />
                                        {uploading[field.name] && (
                                            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">Uploading...</p>
                                        )}
                                        {formData[field.name] && !uploading[field.name] && (
                                            <>
                                                <p className="mt-2 text-sm text-green-600 dark:text-green-400">File uploaded successfully</p>
                                                {field.accept?.includes('image') && (
                                                    <div className="mt-2">
                                                        <AdminImage
                                                            url={formData[field.name]}
                                                            alt={field.label}
                                                            className="h-20 w-20 rounded-lg object-cover border border-stroke dark:border-strokedark"
                                                            placeholderClassName="h-20 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs"
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ) : field.type === 'files' ? (
                                    <div>
                                        <input
                                            type="file"
                                            name={field.name}
                                            multiple
                                            onChange={handleFilesChange}
                                            accept={field.accept}
                                            required={field.required && (!Array.isArray(formData[field.name]) || formData[field.name].length === 0)}
                                            disabled={uploading[field.name]}
                                            className="w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-medium text-black shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                        />
                                        {uploading[field.name] && (
                                            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">Uploading...</p>
                                        )}
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">You can upload multiple images. Max 12 images.</p>
                                        {Array.isArray(formData[field.name]) && formData[field.name].length > 0 && (
                                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                {formData[field.name].map((url: string, idx: number) => (
                                                    <div key={`${url}-${idx}`} className="relative">
                                                        <AdminImage
                                                            url={url}
                                                            alt={field.label}
                                                            className="h-20 w-full rounded-lg object-cover border border-stroke dark:border-strokedark"
                                                            placeholderClassName="h-20 w-full rounded-lg bg-gray-200 dark:bg-gray-700"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setFormData((prev: any) => ({
                                                                    ...prev,
                                                                    [field.name]: (Array.isArray(prev[field.name]) ? prev[field.name] : []).filter((_: string, i: number) => i !== idx),
                                                                }))
                                                            }
                                                            className="absolute top-1 right-1 rounded bg-red-600 text-white text-[10px] px-1.5 py-0.5"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <input
                                        type={field.type}
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={handleChange}
                                        placeholder={field.placeholder}
                                        required={field.required}
                                        className="w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-medium text-black shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full justify-center rounded bg-blue-600 p-3 font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-8"
                    >
                        {loading ? <Loader2 className="animate-spin text-white" /> : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    )
}

export default Form
