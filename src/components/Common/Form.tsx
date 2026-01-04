'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { uploadFile } from '@/utils/storage'
import { Switch } from '@/components/ui/switch'

interface Field {
    name: string;
    label: string;
    type: 'text' | 'email' | 'password' | 'select' | 'textarea' | 'number' | 'checkbox' | 'file' | 'switch';
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
                            <div key={field.name} className={field.type === 'textarea' || field.type === 'checkbox' || field.type === 'switch' ? 'md:col-span-2' : ''}>
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
                                            <p className="mt-2 text-sm text-green-600 dark:text-green-400">File uploaded successfully</p>
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
