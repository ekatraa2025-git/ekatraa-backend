'use client'

import React, { useState, useEffect } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { uploadFile } from '@/utils/storage'
import { AdminImage } from '@/components/Common/AdminImage'
import { toast } from 'sonner'

export default function NewVendorPage() {
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const [catalogCategories, setCatalogCategories] = useState<{ id: string; name: string }[]>([])

    const [formData, setFormData] = useState<any>({
        business_name: '',
        category_id: '',
        category: '',
        owner_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        service_area: '',
        description: '',
        logo_url: '',
        aadhaar_number: '',
        aadhaar_front_url: '',
        aadhaar_back_url: '',
        is_verified: false,
        status: false,
        create_auth: true,
    })

    const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false)
    const [aadhaarReferenceId, setAadhaarReferenceId] = useState<string | null>(null)
    const [aadhaarOtp, setAadhaarOtp] = useState('')
    const [aadhaarVerifying, setAadhaarVerifying] = useState(false)
    const [aadhaarGenerating, setAadhaarGenerating] = useState(false)
    const [aadhaarVerified, setAadhaarVerified] = useState(false)
    const [aadhaarError, setAadhaarError] = useState('')
    const [uploadingFront, setUploadingFront] = useState(false)
    const [uploadingBack, setUploadingBack] = useState(false)
    const [uploadingLogo, setUploadingLogo] = useState(false)

    useEffect(() => {
        fetch('/api/admin/catalog-categories')
            .then((r) => r.json())
            .then((data) => {
                if (data && !data.error && Array.isArray(data)) setCatalogCategories(data)
            })
    }, [])

    const handleChange = (name: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [name]: value }))
    }

    const handleCategoryChange = (categoryId: string) => {
        const cat = catalogCategories.find((c) => c.id === categoryId)
        setFormData((prev: any) => ({
            ...prev,
            category_id: categoryId,
            category: cat?.name || '',
        }))
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
        const file = e.target.files?.[0]
        if (!file) return
        const setUploading =
            fieldName === 'logo_url' ? setUploadingLogo
            : fieldName === 'aadhaar_front_url' ? setUploadingFront
            : setUploadingBack
        setUploading(true)
        try {
            const folder = fieldName === 'logo_url' ? 'vendors' : 'kyc'
            const url = await uploadFile(file, folder)
            if (url) handleChange(fieldName, url)
        } catch (error) {
            console.error('Upload error:', error)
        } finally {
            setUploading(false)
        }
    }

    const handleGenerateAadhaarOTP = async () => {
        if (!formData.aadhaar_number || formData.aadhaar_number.length !== 12) {
            setAadhaarError('Please enter a valid 12-digit Aadhaar number.')
            return
        }
        setAadhaarError('')
        setAadhaarGenerating(true)
        try {
            const res = await fetch('/api/kyc/aadhaar/generate-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    aadhaar_number: formData.aadhaar_number,
                    vendor_id: 'admin-onboarding',
                    aadhaar_front_url: formData.aadhaar_front_url || null,
                    aadhaar_back_url: formData.aadhaar_back_url || null,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                setAadhaarError(data.error || 'Failed to generate OTP')
                return
            }
            if (data.data?.reference_id) {
                setAadhaarReferenceId(String(data.data.reference_id))
                setAadhaarOtpSent(true)
            } else {
                setAadhaarError(data.message || 'Failed to generate OTP - no reference ID returned')
            }
        } catch (err: any) {
            setAadhaarError(err.message || 'Network error generating OTP')
        } finally {
            setAadhaarGenerating(false)
        }
    }

    const handleVerifyAadhaarOTP = async () => {
        if (!aadhaarOtp || aadhaarOtp.length !== 6) {
            setAadhaarError('Please enter a valid 6-digit OTP.')
            return
        }
        setAadhaarError('')
        setAadhaarVerifying(true)
        try {
            const res = await fetch('/api/kyc/aadhaar/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reference_id: aadhaarReferenceId,
                    otp: aadhaarOtp.trim(),
                    vendor_id: 'admin-onboarding',
                    aadhaar_number: formData.aadhaar_number,
                    aadhaar_front_url: formData.aadhaar_front_url || null,
                    aadhaar_back_url: formData.aadhaar_back_url || null,
                }),
            })
            const data = await res.json()
            if (data.success) {
                setAadhaarVerified(true)
                setFormData((prev: any) => ({ ...prev, is_verified: true }))
            } else {
                setAadhaarError(data.error || 'OTP verification failed')
            }
        } catch (err: any) {
            setAadhaarError(err.message || 'Network error verifying OTP')
        } finally {
            setAadhaarVerifying(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        const submitData: any = { ...formData }
        submitData.status = submitData.status ? 'active' : 'pending'
        if (submitData.is_verified) submitData.aadhaar_verified = true
        delete submitData.create_auth

        const res = await fetch('/api/admin/vendors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submitData),
        })
        const result = await res.json()
        setLoading(false)
        if (result.error) {
            toast.error(result.error)
        } else {
            if (result.auth_note) toast.success(result.auth_note)
            router.push('/admin/vendors')
        }
    }

    const inputClass = 'w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-medium text-black shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-form-strokedark dark:bg-form-input dark:text-white'
    const selectClass = inputClass
    const labelClass = 'mb-2 block text-sm font-medium text-black dark:text-white'

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-270">
                <div className="mb-6">
                    <h2 className="text-title-md2 font-bold text-black dark:text-white">Add New Vendor</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Create a new vendor. Use Catalog Category; add services from the edit page after creation.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <Tabs defaultValue="business" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                            <TabsTrigger value="business">Business Info</TabsTrigger>
                            <TabsTrigger value="kyc">KYC</TabsTrigger>
                            <TabsTrigger value="status">Status</TabsTrigger>
                        </TabsList>

                        <TabsContent value="business">
                            <div className="rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark p-6">
                                <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Business Information</h3>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div className="md:col-span-2">
                                        <label className={labelClass}>Profile / Logo Image</label>
                                        <div className="flex items-center gap-4 mt-2">
                                            {formData.logo_url && (
                                                <AdminImage url={formData.logo_url} alt="Logo" className="h-20 w-20 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700" placeholderClassName="h-20 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs" />
                                            )}
                                            <div className="flex-1">
                                                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo_url')} disabled={uploadingLogo} className={inputClass + ' file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90'} />
                                                {uploadingLogo && <p className="mt-1 text-sm text-blue-600">Uploading...</p>}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Business Name <span className="text-red-500">*</span></label>
                                        <input type="text" value={formData.business_name} onChange={(e) => handleChange('business_name', e.target.value)} required className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Catalog Category <span className="text-red-500">*</span></label>
                                        <select value={formData.category_id} onChange={(e) => handleCategoryChange(e.target.value)} required className={selectClass}>
                                            <option value="">Select Catalog Category</option>
                                            {catalogCategories.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Owner Name <span className="text-red-500">*</span></label>
                                        <input type="text" value={formData.owner_name} onChange={(e) => handleChange('owner_name', e.target.value)} required className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Email <span className="text-red-500">*</span></label>
                                        <input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} required className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Phone <span className="text-red-500">*</span></label>
                                        <input type="text" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} required maxLength={10} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Service Area</label>
                                        <input type="text" value={formData.service_area} onChange={(e) => handleChange('service_area', e.target.value)} className={inputClass} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelClass}>Address <span className="text-red-500">*</span></label>
                                        <textarea value={formData.address} onChange={(e) => handleChange('address', e.target.value)} required rows={3} className={inputClass + ' resize-none'} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>City</label>
                                        <input type="text" value={formData.city} onChange={(e) => handleChange('city', e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>State</label>
                                        <select value={formData.state || ''} onChange={(e) => handleChange('state', e.target.value)} className={selectClass}>
                                            <option value="">Select State</option>
                                            {['Odisha', 'Assam', 'West Bengal', 'Karnataka', 'Telangana', 'Tamil Nadu', 'Maharashtra', 'Delhi', 'Gujarat', 'Rajasthan', 'Kerala', 'Andhra Pradesh', 'Other'].map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelClass}>Business Description</label>
                                        <textarea value={formData.description} onChange={(e) => handleChange('description', e.target.value)} rows={3} className={inputClass + ' resize-none'} />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="kyc">
                            <div className="rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-black dark:text-white flex items-center gap-2">
                                        <Shield size={20} /> Aadhaar KYC Verification
                                    </h3>
                                    {aadhaarVerified && (
                                        <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold dark:bg-green-900 dark:text-green-300">
                                            <CheckCircle2 size={14} /> Verified
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div>
                                        <label className={labelClass}>Aadhaar Number</label>
                                        <input
                                            type="text"
                                            value={formData.aadhaar_number}
                                            onChange={(e) => handleChange('aadhaar_number', e.target.value.replace(/\D/g, '').slice(0, 12))}
                                            placeholder="12-digit Aadhaar"
                                            maxLength={12}
                                            className={inputClass}
                                            disabled={aadhaarVerified}
                                        />
                                    </div>
                                    <div className="flex items-end gap-3">
                                        {!aadhaarOtpSent && !aadhaarVerified && (
                                            <button
                                                type="button"
                                                onClick={handleGenerateAadhaarOTP}
                                                disabled={aadhaarGenerating || !formData.aadhaar_number || formData.aadhaar_number.length !== 12}
                                                className="px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {aadhaarGenerating ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                                                {aadhaarGenerating ? 'Sending OTP...' : 'Generate OTP'}
                                            </button>
                                        )}
                                    </div>
                                    {aadhaarOtpSent && !aadhaarVerified && (
                                        <>
                                            <div>
                                                <label className={labelClass}>Enter OTP (6 digits)</label>
                                                <input type="text" value={aadhaarOtp} onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} className={inputClass} />
                                            </div>
                                            <div className="flex items-end gap-3">
                                                <button type="button" onClick={handleVerifyAadhaarOTP} disabled={aadhaarVerifying || aadhaarOtp.length !== 6} className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                                                    {aadhaarVerifying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                    {aadhaarVerifying ? 'Verifying...' : 'Verify OTP'}
                                                </button>
                                                <button type="button" onClick={() => { setAadhaarOtpSent(false); setAadhaarOtp(''); setAadhaarReferenceId(null); setAadhaarError('') }} className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold dark:bg-gray-700 dark:text-gray-300">
                                                    Resend
                                                </button>
                                            </div>
                                        </>
                                    )}
                                    <div>
                                        <label className={labelClass}>Aadhaar Front Image</label>
                                        <div className="flex items-center gap-4 mt-2">
                                            {formData.aadhaar_front_url && (
                                                <AdminImage url={formData.aadhaar_front_url} alt="Aadhaar front" className="h-20 w-28 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700" placeholderClassName="h-20 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs" />
                                            )}
                                            <div className="flex-1">
                                                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'aadhaar_front_url')} disabled={uploadingFront} className={inputClass + ' file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white'} />
                                                {uploadingFront && <p className="mt-1 text-sm text-blue-600">Uploading...</p>}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Aadhaar Back Image</label>
                                        <div className="flex items-center gap-4 mt-2">
                                            {formData.aadhaar_back_url && (
                                                <AdminImage url={formData.aadhaar_back_url} alt="Aadhaar back" className="h-20 w-28 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700" placeholderClassName="h-20 w-28 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs" />
                                            )}
                                            <div className="flex-1">
                                                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'aadhaar_back_url')} disabled={uploadingBack} className={inputClass + ' file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white'} />
                                                {uploadingBack && <p className="mt-1 text-sm text-blue-600">Uploading...</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {aadhaarError && (
                                    <div className="mt-4 flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900/20 dark:text-red-400">
                                        <AlertCircle size={16} /> <span className="text-sm">{aadhaarError}</span>
                                    </div>
                                )}
                                <div className="mt-6 pt-4 border-t border-stroke dark:border-strokedark flex items-center space-x-3">
                                    <Switch checked={formData.is_verified} onCheckedChange={(checked) => handleChange('is_verified', checked)} />
                                    <span className="text-sm font-medium text-black dark:text-white">Identity Verified (manual)</span>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="status">
                            <div className="rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark p-6">
                                <h3 className="text-lg font-semibold text-black dark:text-white mb-4">Status & Authentication</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-3 rounded-lg border border-stroke bg-gray-50 px-4 py-3 dark:border-strokedark dark:bg-gray-900">
                                        <Switch checked={formData.status} onCheckedChange={(checked) => handleChange('status', checked)} />
                                        <span className="text-sm font-medium text-black dark:text-white">{formData.status ? 'Active' : 'Pending'}</span>
                                    </div>
                                    <div className="flex items-center space-x-3 rounded-lg border border-stroke bg-gray-50 px-4 py-3 dark:border-strokedark dark:bg-gray-900">
                                        <Switch checked={formData.create_auth} onCheckedChange={(checked) => handleChange('create_auth', checked)} />
                                        <div>
                                            <span className="text-sm font-medium text-black dark:text-white">{formData.create_auth ? 'Create Auth Account' : 'Skip Auth'}</span>
                                            <p className="text-xs text-gray-500 mt-0.5">Phone OTP login for vendor app</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <p className="text-sm text-muted-foreground mt-4 mb-4">After creating the vendor, open the vendor edit page to add services from Catalog Categories.</p>

                    <button type="submit" disabled={loading} className="flex w-full justify-center rounded-lg bg-blue-600 p-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin" /> : 'Create Vendor'}
                    </button>
                </form>
            </div>
        </DefaultLayout>
    )
}
