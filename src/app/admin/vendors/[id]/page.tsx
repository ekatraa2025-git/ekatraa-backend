'use client'

import React, { useEffect, useState } from 'react'
import DefaultLayout from '@/components/Layouts/DefaultLayout'
import { useRouter, useParams } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { uploadFile } from '@/utils/storage'
import { AdminImage } from '@/components/Common/AdminImage'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/Common/ConfirmDialog'

const CATALOG_TIER_DEFS: { key: string; label: string }[] = [
    { key: 'basic', label: 'Basic' },
    { key: 'classic_value', label: 'Classic Value' },
    { key: 'signature', label: 'Signature' },
    { key: 'prestige', label: 'Prestige' },
    { key: 'royal', label: 'Royal' },
    { key: 'imperial', label: 'Imperial' },
]

function catalogTierLabel(tierKey: string): string {
    if (!tierKey) return ''
    const def = CATALOG_TIER_DEFS.find((t) => t.key === tierKey)
    return def?.label ?? tierKey.replace(/_/g, ' ')
}

export default function EditVendorPage() {
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)
    const router = useRouter()
    const { id } = useParams()

    // Catalog categories and offerable services (replacing vendor_categories + subcategories + stocks)
    const [catalogCategories, setCatalogCategories] = useState<{ id: string; name: string }[]>([])
    const [offerableServices, setOfferableServices] = useState<any[]>([])
    const [selectedOfferableService, setSelectedOfferableService] = useState<any>(null)
    const [serviceTierKey, setServiceTierKey] = useState('')
    const [servicePriceAmount, setServicePriceAmount] = useState('')

    // Form data
    const [formData, setFormData] = useState<any>({})

    // Aadhaar OTP verification
    const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false)
    const [aadhaarReferenceId, setAadhaarReferenceId] = useState<string | null>(null)
    const [aadhaarOtp, setAadhaarOtp] = useState('')
    const [aadhaarVerifying, setAadhaarVerifying] = useState(false)
    const [aadhaarGenerating, setAadhaarGenerating] = useState(false)
    const [aadhaarVerified, setAadhaarVerified] = useState(false)
    const [aadhaarError, setAadhaarError] = useState('')

    // File upload states
    const [uploadingFront, setUploadingFront] = useState(false)
    const [uploadingBack, setUploadingBack] = useState(false)
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [uploadingGallery, setUploadingGallery] = useState(false)

    // Selected stock for pricing tiers (legacy name kept for add-service flow)
    const [selectedStock, setSelectedStock] = useState<any>(null)

    // Vendor services (multiple service items with pricing and images)
    const [vendorServices, setVendorServices] = useState<any[]>([])
    // Add-from-catalog: image for the service being added
    const [serviceImageForAdd, setServiceImageForAdd] = useState('')
    const [uploadingServiceForAdd, setUploadingServiceForAdd] = useState(false)
    const [addingServiceFromCatalog, setAddingServiceFromCatalog] = useState(false)
    /** serviceId -> selected tier keys (multi-select per catalog row) */
    const [bulkSelections, setBulkSelections] = useState<Record<string, string[]>>({})
    const [deleteServiceTarget, setDeleteServiceTarget] = useState<string | null>(null)

    useEffect(() => {
        fetchInitialData()
    }, [id])

    const fetchInitialData = async () => {
        setFetching(true)
        try {
            const [vendorRes, catalogRes] = await Promise.all([
                fetch(`/api/admin/vendors/${id}`),
                fetch('/api/admin/catalog-categories'),
            ])
            const vendorData = await vendorRes.json()
            const catalogData = await catalogRes.json()

            if (catalogData && !catalogData.error && Array.isArray(catalogData)) {
                setCatalogCategories(catalogData)
            }

            if (vendorData.error) {
                toast.error(vendorData.error)
                router.push('/admin/vendors')
                return
            }

            setFormData({
                ...vendorData,
                status: vendorData.status === 'active',
                is_verified: vendorData.is_verified === true,
                category: (catalogData && Array.isArray(catalogData) && catalogData.find((c: any) => c.id === vendorData.category_id)?.name) || vendorData.category || '',
                gallery_urls: Array.isArray(vendorData.gallery_urls) ? vendorData.gallery_urls.filter(Boolean) : [],
            })

            if (vendorData.is_verified) {
                setAadhaarVerified(true)
            }

            if (vendorData.category_id) {
                const offerRes = await fetch(`/api/admin/offerable-services?category_id=${vendorData.category_id}`)
                const offerData = await offerRes.json()
                if (offerData && !offerData.error && Array.isArray(offerData)) {
                    setOfferableServices(offerData)
                }
            }

            const svcRes = await fetch(`/api/admin/services?vendor_id=${id}`)
            const svcData = await svcRes.json()
            if (svcData && !svcData.error && Array.isArray(svcData)) {
                setVendorServices(svcData)
            }
        } catch (err) {
            console.error('Fetch error:', err)
        } finally {
            setFetching(false)
        }
    }

    const fetchVendorServices = async () => {
        if (!id) return
        const res = await fetch(`/api/admin/services?vendor_id=${id}`)
        const data = await res.json()
        if (data && !data.error && Array.isArray(data)) setVendorServices(data)
    }

    const handleAddServiceFromCatalog = async () => {
        const name = selectedOfferableService?.name || formData.service_stock_name || selectedStock?.name
        const price = servicePriceAmount || formData.service_price_amount
        if (!name || !price) {
            toast.error('Select a catalog service and a pricing tier first.')
            return
        }
        setAddingServiceFromCatalog(true)
        try {
            const tierKeySingle = serviceTierKey || formData.service_pricing_type
            const body: any = {
                vendor_id: id,
                name,
                price_amount: parseFloat(String(price)),
                price_unit: 'event',
                category: formData.category || '',
            }
            if (tierKeySingle) body.pricing_tier = catalogTierLabel(tierKeySingle)
            if (serviceImageForAdd) body.image_url = serviceImageForAdd
            const res = await fetch('/api/admin/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const result = await res.json()
            if (result.error) throw new Error(result.error)
            setServiceImageForAdd('')
            setFormData((prev: any) => ({
                ...prev,
                service_stock_id: '',
                service_stock_name: '',
                service_pricing_type: '',
                service_price_amount: '',
            }))
            setSelectedStock(null)
            setSelectedOfferableService(null)
            setServiceTierKey('')
            setServicePriceAmount('')
            await fetchVendorServices()
        } catch (err: any) {
            toast.error(err?.message || 'Failed to add service')
        } finally {
            setAddingServiceFromCatalog(false)
        }
    }

    const toggleBulkService = (serviceId: string) => {
        setBulkSelections((prev) => {
            if (serviceId in prev) {
                const { [serviceId]: _, ...rest } = prev
                return rest
            }
            return { ...prev, [serviceId]: [] }
        })
    }

    const toggleBulkTier = (serviceId: string, tierKey: string) => {
        setBulkSelections((prev) => {
            if (!(serviceId in prev)) return prev
            const cur = prev[serviceId] || []
            const next = cur.includes(tierKey) ? cur.filter((t) => t !== tierKey) : [...cur, tierKey]
            return { ...prev, [serviceId]: next }
        })
    }

    const handleAddSelectedServicesFromCatalog = async () => {
        const entries = Object.entries(bulkSelections)
        if (!entries.length) {
            toast.error('Select one or more catalog services.')
            return
        }
        const hasAnyTier = entries.some(([, tiers]) => tiers.length > 0)
        if (!hasAnyTier) {
            toast.error('Pick at least one pricing tier for each service you want to add (tiers under each selected row).')
            return
        }
        setAddingServiceFromCatalog(true)
        let added = 0
        let skipped = 0
        try {
            for (const [sid, tierKeys] of entries) {
                const svc = offerableServices.find((s: any) => s.id === sid)
                if (!svc) {
                    skipped++
                    continue
                }
                for (const tier of tierKeys) {
                    const price = getOfferableTierPrice(svc, tier)
                    if (price == null) {
                        skipped++
                        continue
                    }
                    const body: any = {
                        vendor_id: id,
                        name: svc.name,
                        price_amount: price,
                        price_unit: 'event',
                        category: formData.category || '',
                        pricing_tier: catalogTierLabel(tier),
                    }
                    const res = await fetch('/api/admin/services', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    })
                    const result = await res.json()
                    if (result.error) skipped++
                    else added++
                }
            }
            if (added > 0) {
                toast.success(`Added ${added} line(s)${skipped ? ` (${skipped} skipped — no price or error)` : ''}`)
                setBulkSelections({})
                setSelectedOfferableService(null)
                setSelectedStock(null)
                setServiceTierKey('')
                setServicePriceAmount('')
                setFormData((prev: any) => ({
                    ...prev,
                    service_stock_id: '',
                    service_stock_name: '',
                    service_pricing_type: '',
                    service_price_amount: '',
                }))
                await fetchVendorServices()
            } else {
                toast.error(skipped ? 'Nothing added — check tiers have prices for each service.' : 'Nothing to add.')
            }
        } catch (err: any) {
            toast.error(err?.message || 'Bulk add failed')
        } finally {
            setAddingServiceFromCatalog(false)
        }
    }

    const handleServiceImageForAddUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingServiceForAdd(true)
        try {
            const url = await uploadFile(file, 'services')
            if (url) setServiceImageForAdd(url)
        } catch (err) {
            console.error(err)
        } finally {
            setUploadingServiceForAdd(false)
        }
    }

    const handleDeleteService = (serviceId: string) => {
        setDeleteServiceTarget(serviceId)
    }

    const confirmDeleteService = async () => {
        if (!deleteServiceTarget) return
        try {
            const res = await fetch(`/api/admin/services/${deleteServiceTarget}`, { method: 'DELETE' })
            const result = await res.json()
            if (result.error) throw new Error(result.error)
            await fetchVendorServices()
            toast.success('Service deleted successfully')
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete')
        } finally {
            setDeleteServiceTarget(null)
        }
    }

    const getOfferableTierPrice = (svc: any, tierKey: string): number | null => {
        const fieldMap: Record<string, string> = {
            basic: 'price_basic',
            classic_value: 'price_classic_value',
            signature: 'price_signature',
            prestige: 'price_prestige',
            royal: 'price_royal',
            imperial: 'price_imperial',
        }
        const field = fieldMap[tierKey]
        if (!field || !svc) return null
        const v = svc[field]
        if (v == null || v === '') return null
        const n = Number(v)
        return Number.isFinite(n) && n > 0 ? n : null
    }

    const fetchOfferableServices = async (categoryId: string) => {
        setOfferableServices([])
        setSelectedOfferableService(null)
        setSelectedStock(null)
        setServiceTierKey('')
        setServicePriceAmount('')
        setBulkSelections({})
        if (!categoryId) return
        const res = await fetch(`/api/admin/offerable-services?category_id=${categoryId}`)
        const data = await res.json()
        if (data && !data.error && Array.isArray(data)) setOfferableServices(data)
    }

    const handleChange = (name: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [name]: value }))
    }

    const handleCategoryChange = (categoryId: string) => {
        const cat = catalogCategories.find((c) => c.id === categoryId)
        setFormData((prev: any) => ({ ...prev, category_id: categoryId, category: cat?.name || '' }))
        if (categoryId) fetchOfferableServices(categoryId)
    }

    const handleOfferableServiceSelect = (svc: any) => {
        setSelectedOfferableService(svc)
        setSelectedStock(svc)
        setFormData((prev: any) => ({
            ...prev,
            service_stock_id: svc.id,
            service_stock_name: svc.name,
            service_pricing_type: '',
            service_price_amount: '',
        }))
        setServiceTierKey('')
        setServicePriceAmount('')
    }

    const handlePricingTierSelect = (tierKey: string, price: number) => {
        setServiceTierKey(tierKey)
        setServicePriceAmount(String(price))
        setFormData((prev: any) => ({
            ...prev,
            service_pricing_type: tierKey,
            service_price_amount: String(price),
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
            if (url) {
                handleChange(fieldName, url)
            }
        } catch (error) {
            console.error('Upload error:', error)
        } finally {
            setUploading(false)
        }
    }

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const current = Array.isArray(formData.gallery_urls) ? formData.gallery_urls : []
        if (current.length >= 12) {
            toast.error('Maximum 12 gallery images.')
            e.target.value = ''
            return
        }
        setUploadingGallery(true)
        try {
            const url = await uploadFile(file, 'vendors')
            if (url) {
                handleChange('gallery_urls', [...current, url])
                toast.success('Image added to gallery (save to persist)')
            }
        } catch (error) {
            console.error('Gallery upload error:', error)
            toast.error('Failed to upload image')
        } finally {
            setUploadingGallery(false)
            e.target.value = ''
        }
    }

    const removeGalleryImage = (index: number) => {
        const current = Array.isArray(formData.gallery_urls) ? [...formData.gallery_urls] : []
        current.splice(index, 1)
        handleChange('gallery_urls', current)
    }

    // Aadhaar OTP generation
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
                    vendor_id: id,
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

    // Aadhaar OTP verification
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
                    vendor_id: id,
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

        // Convert switches
        submitData.status = submitData.status ? 'active' : 'pending'
        if (typeof submitData.is_verified === 'boolean') {
            submitData.aadhaar_verified = submitData.is_verified
        }

        // Remove fields that aren't vendor columns
        delete submitData.service_subcategory
        delete submitData.service_stock_id
        delete submitData.service_stock_name
        delete submitData.service_pricing_type
        delete submitData.service_price_amount
        delete submitData.vendor_categories
        delete submitData.create_auth

        const uuidRe =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (submitData.category_id != null && typeof submitData.category_id === 'string' && !uuidRe.test(submitData.category_id.trim())) {
            delete submitData.category_id
        }
        delete submitData.id

        const res = await fetch(`/api/admin/vendors/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submitData),
        })
        const result = await res.json()
        setLoading(false)

        if (result.error) {
            toast.error(result.error)
        } else {
            router.push('/admin/vendors')
        }
    }

    const tierPreviewService = selectedOfferableService || selectedStock || null

    const bulkSelectionCount = Object.keys(bulkSelections).length
    const bulkReadyToAddCount = Object.values(bulkSelections).reduce((n, tiers) => n + tiers.length, 0)

    const inputClass = "w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-medium text-black shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-form-strokedark dark:bg-form-input dark:text-white"
    const selectClass = inputClass
    const labelClass = "mb-2 block text-sm font-medium text-black dark:text-white"

    if (fetching) return (
        <DefaultLayout>
            <div className="flex h-60 items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" />
            </div>
        </DefaultLayout>
    )

    return (
        <DefaultLayout>
            <div className="mx-auto max-w-270">
                <div className="mb-6">
                    <h2 className="text-title-md2 font-bold text-black dark:text-white">
                        Edit Vendor: {formData?.business_name}
                    </h2>
                </div>

                <form onSubmit={handleSubmit}>
                    <Tabs defaultValue="business" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-6 gap-1">
                            <TabsTrigger value="business">Business Info</TabsTrigger>
                            <TabsTrigger value="services">Categories & Services</TabsTrigger>
                            <TabsTrigger value="gallery">Gallery</TabsTrigger>
                            <TabsTrigger value="kyc">KYC</TabsTrigger>
                            <TabsTrigger value="status">Status</TabsTrigger>
                        </TabsList>

                    {/* Tab: Business Info */}
                    <TabsContent value="business">
                    <div className="rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark mb-6">
                        <div className="border-b border-stroke px-6 py-4 dark:border-strokedark bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-boxdark">
                            <h3 className="text-lg font-semibold text-black dark:text-white">Business Information</h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Profile / Logo Image</label>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Shown on vendor details in the app.</p>
                                    <div className="flex items-center gap-4">
                                        {formData.logo_url ? (
                                            <AdminImage url={formData.logo_url} alt="Logo" className="h-20 w-20 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700 flex-shrink-0" placeholderClassName="h-20 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs flex-shrink-0" />
                                        ) : null}
                                        <div className="flex-1">
                                            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'logo_url')} disabled={uploadingLogo} className={inputClass + ' file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90'} />
                                            {uploadingLogo && <p className="mt-1 text-sm text-blue-600">Uploading...</p>}
                                            {formData.logo_url && !uploadingLogo && <p className="mt-1 text-sm text-green-600">Profile image uploaded</p>}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Business Name <span className="text-red-500">*</span></label>
                                    <input type="text" value={formData.business_name || ''} onChange={(e) => handleChange('business_name', e.target.value)} required className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Catalog Category <span className="text-red-500">*</span></label>
                                    <select value={formData.category_id || ''} onChange={(e) => handleCategoryChange(e.target.value)} required className={selectClass}>
                                        <option value="">Select Catalog Category</option>
                                        {catalogCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Owner Name <span className="text-red-500">*</span></label>
                                    <input type="text" value={formData.owner_name || ''} onChange={(e) => handleChange('owner_name', e.target.value)} required className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Email <span className="text-red-500">*</span></label>
                                    <input type="email" value={formData.email || ''} onChange={(e) => handleChange('email', e.target.value)} required className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Phone</label>
                                    <input type="text" value={formData.phone || ''} onChange={(e) => handleChange('phone', e.target.value)} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Service Area</label>
                                    <input type="text" value={formData.service_area || ''} onChange={(e) => handleChange('service_area', e.target.value)} className={inputClass} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Address</label>
                                    <textarea value={formData.address || ''} onChange={(e) => handleChange('address', e.target.value)} placeholder="Full business address (City will be auto-extracted if updated)" rows={3} className={inputClass + ' resize-none'} />
                                </div>
                                <div>
                                    <label className={labelClass}>City (Auto-extracted from address)</label>
                                    <input type="text" value={formData.city || ''} onChange={(e) => handleChange('city', e.target.value)} placeholder="Will be extracted from address" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>State</label>
                                    <select value={formData.state || ''} onChange={(e) => handleChange('state', e.target.value)} className={inputClass}>
                                        <option value="">Select State</option>
                                        {['Odisha', 'Assam', 'West Bengal', 'Karnataka', 'Telangana', 'Tamil Nadu', 'Maharashtra', 'Delhi', 'Gujarat', 'Rajasthan', 'Kerala', 'Andhra Pradesh', 'Other'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Business Description</label>
                                    <textarea value={formData.description || ''} onChange={(e) => handleChange('description', e.target.value)} placeholder="Brief description of the business" rows={3} className={inputClass + ' resize-none'} />
                                </div>
                            </div>
                        </div>
                    </div>
                    </TabsContent>

                    {/* Tab: Categories & Services — Catalog Category → offerable services → add to vendor */}
                    <TabsContent value="services">
                    <div className="rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark mb-6">
                        <div className="border-b border-stroke px-6 py-4 dark:border-strokedark bg-gradient-to-r from-blue-50 to-white dark:from-blue-950 dark:to-boxdark">
                            <h3 className="text-lg font-semibold text-black dark:text-white">Add New Service</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select Catalog Category, then a service and pricing tier from the catalog.</p>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <label className={labelClass}>Catalog Category</label>
                                    {!formData.category_id ? (
                                        <p className="text-sm text-gray-400 dark:text-gray-500 italic py-3">Select a Catalog Category in Business Info first</p>
                                    ) : (
                                        <select value={formData.category_id} onChange={(e) => handleCategoryChange(e.target.value)} className={selectClass}>
                                            <option value="">Select category</option>
                                            {catalogCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelClass}>Services (from catalog)</label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                        Tick services to show tier chips per row — you can select multiple tiers per service. Use &quot;Add all with tiers&quot; to save every combination at once. Use &quot;Use for single add&quot; for one service with optional image.
                                    </p>
                                    {!formData.category_id ? (
                                        <p className="text-sm text-gray-400 dark:text-gray-500 italic py-3">Select category first</p>
                                    ) : offerableServices.length === 0 ? (
                                        <p className="text-sm text-gray-400 dark:text-gray-500 italic py-3">No services in this category</p>
                                    ) : (
                                        <div className="rounded-lg border border-stroke dark:border-strokedark overflow-hidden">
                                            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-stroke dark:border-strokedark">
                                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                                    {bulkSelectionCount} selected · {bulkReadyToAddCount} tier line(s) to add
                                                </span>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        className="text-xs font-medium text-primary hover:underline"
                                                        onClick={() =>
                                                            setBulkSelections(
                                                                Object.fromEntries(
                                                                    offerableServices.map((sv: any) => [
                                                                        sv.id,
                                                                        bulkSelections[sv.id] ?? [],
                                                                    ])
                                                                )
                                                            )
                                                        }
                                                    >
                                                        Select all
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="text-xs font-medium text-gray-500 hover:underline"
                                                        onClick={() => setBulkSelections({})}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="max-h-96 overflow-y-auto divide-y divide-stroke dark:divide-strokedark">
                                                {offerableServices.map((s: any) => {
                                                    const checked = s.id in bulkSelections
                                                    const rowTiers = bulkSelections[s.id] ?? []
                                                    return (
                                                        <div
                                                            key={s.id}
                                                            className={`${selectedOfferableService?.id === s.id ? 'bg-primary/5' : ''}`}
                                                        >
                                                            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/80">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => toggleBulkService(s.id)}
                                                                    className="h-4 w-4 shrink-0 rounded border-stroke text-primary"
                                                                />
                                                                <span className="min-w-0 flex-1 text-sm text-black dark:text-white">{s.name}</span>
                                                                <button
                                                                    type="button"
                                                                    className="text-xs text-primary font-medium shrink-0"
                                                                    onClick={(e) => {
                                                                        e.preventDefault()
                                                                        e.stopPropagation()
                                                                        handleOfferableServiceSelect(s)
                                                                    }}
                                                                >
                                                                    Use for single add
                                                                </button>
                                                            </label>
                                                            {checked && (
                                                                <div className="px-3 pb-3 pl-10">
                                                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                                                                        Tiers for this service (multi-select)
                                                                    </p>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {CATALOG_TIER_DEFS.map((def) => {
                                                                            const price = getOfferableTierPrice(s, def.key)
                                                                            const active = rowTiers.includes(def.key)
                                                                            const disabled = price == null
                                                                            return (
                                                                                <button
                                                                                    key={def.key}
                                                                                    type="button"
                                                                                    disabled={disabled}
                                                                                    onClick={() => toggleBulkTier(s.id, def.key)}
                                                                                    className={`min-h-[3.25rem] min-w-[4.5rem] max-w-[7.5rem] rounded-md border px-1.5 py-1 text-left transition-all ${
                                                                                        disabled
                                                                                            ? 'cursor-not-allowed border-stroke/50 opacity-40 dark:border-strokedark/50'
                                                                                            : active
                                                                                              ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                                                                              : 'border-stroke hover:border-gray-300 dark:border-strokedark dark:hover:border-gray-600'
                                                                                    }`}
                                                                                >
                                                                                    <span
                                                                                        className={`block text-[10px] font-semibold leading-tight break-words hyphens-auto ${
                                                                                            active ? 'text-primary' : 'text-black dark:text-white'
                                                                                        }`}
                                                                                    >
                                                                                        {def.label}
                                                                                    </span>
                                                                                    {price != null && (
                                                                                        <span
                                                                                            className={`mt-0.5 block text-[10px] font-bold leading-tight break-all ${
                                                                                                active ? 'text-primary' : 'text-gray-600 dark:text-gray-300'
                                                                                            }`}
                                                                                        >
                                                                                            ₹{Number(price).toLocaleString()}
                                                                                        </span>
                                                                                    )}
                                                                                </button>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            {bulkSelectionCount > 0 && (
                                                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stroke dark:border-strokedark bg-gray-50/80 dark:bg-gray-900/80 px-3 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleAddSelectedServicesFromCatalog}
                                                        disabled={addingServiceFromCatalog || bulkReadyToAddCount === 0}
                                                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                                                    >
                                                        {addingServiceFromCatalog
                                                            ? 'Adding...'
                                                            : `Add all with tiers (${bulkReadyToAddCount})`}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Pricing tiers — single add only */}
                                {tierPreviewService && (selectedOfferableService || selectedStock) && (
                                    <div className="md:col-span-2">
                                        <label className={labelClass}>Pricing Tier (single add)</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                            {CATALOG_TIER_DEFS.map((def) => {
                                                const p = getOfferableTierPrice(tierPreviewService, def.key) ?? 0
                                                return (
                                                    <button
                                                        key={def.key}
                                                        type="button"
                                                        onClick={() => handlePricingTierSelect(def.key, p)}
                                                        className={`min-h-[3.5rem] rounded-lg border-2 px-2 py-1.5 text-left transition-all ${serviceTierKey === def.key || formData.service_pricing_type === def.key
                                                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                                            : 'border-stroke hover:border-gray-300 dark:border-strokedark dark:hover:border-gray-600'
                                                            }`}
                                                    >
                                                        <span className={`block text-[10px] font-semibold leading-tight break-words ${serviceTierKey === def.key ? 'text-primary' : 'text-black dark:text-white'}`}>
                                                            {def.label}
                                                        </span>
                                                        <span className={`mt-0.5 block text-[10px] font-bold leading-tight break-all ${serviceTierKey === def.key ? 'text-primary' : 'text-gray-600 dark:text-gray-300'}`}>
                                                            ₹{p.toLocaleString()}
                                                        </span>
                                                        {serviceTierKey === def.key && (
                                                            <div className="mt-1 flex items-center gap-0.5 text-primary text-[9px] font-semibold">
                                                                <CheckCircle2 size={10} className="shrink-0" /> OK
                                                            </div>
                                                        )}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {(servicePriceAmount || formData.service_price_amount) && (selectedOfferableService || selectedStock) && (
                                    <div className="md:col-span-2 space-y-4">
                                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                                            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Selected Service</p>
                                            <p className="text-2xl font-bold text-primary">₹{(servicePriceAmount || formData.service_price_amount).toLocaleString()}</p>
                                            <p className="text-sm text-gray-500 mt-1">{formData.category} → {selectedOfferableService?.name || selectedStock?.name}</p>
                                            <p className="text-sm font-semibold text-gray-500">Tier: {(serviceTierKey || formData.service_pricing_type || '').replace(/_/g, ' ')}</p>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Service image (optional)</label>
                                            <div className="flex items-center gap-4 mt-2">
                                                {serviceImageForAdd && <AdminImage url={serviceImageForAdd} alt="Service" className="h-16 w-16 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700 flex-shrink-0" placeholderClassName="h-16 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs flex-shrink-0" />}
                                                <div className="flex-1 min-w-0">
                                                    <input type="file" accept="image/*" onChange={handleServiceImageForAddUpload} disabled={uploadingServiceForAdd} className={inputClass + ' file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white'} />
                                                    {uploadingServiceForAdd && <p className="mt-1 text-sm text-blue-600">Uploading...</p>}
                                                </div>
                                            </div>
                                        </div>
                                        <button type="button" onClick={handleAddServiceFromCatalog} disabled={addingServiceFromCatalog} className="px-4 py-2 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                                            {addingServiceFromCatalog ? 'Adding...' : 'Add this service (single)'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Vendor Services list (same tab) */}
                    <div className="rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark mb-6">
                        <div className="border-b border-stroke px-6 py-4 dark:border-strokedark bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950 dark:to-boxdark">
                            <h3 className="text-lg font-semibold text-black dark:text-white">Vendor Services &amp; Pricing</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All service items and pricings for this vendor. Shown in the app on the vendor details page. Upload images to Supabase storage.</p>
                        </div>
                        <div className="p-6">
                            {vendorServices.length > 0 && (
                                <div className="mb-6">
                                    <h4 className="text-sm font-semibold text-black dark:text-white mb-3">Current services</h4>
                                    <ul className="space-y-3">
                                        {vendorServices.map((svc: any) => (
                                            <li key={svc.id} className="flex items-center gap-4 rounded-lg border border-stroke dark:border-strokedark p-3 bg-gray-50 dark:bg-gray-900">
                                                <AdminImage url={svc.image_url} alt="" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-black dark:text-white truncate">{svc.name}</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {svc.pricing_tier ? <span className="font-medium text-gray-600 dark:text-gray-300">{svc.pricing_tier} · </span> : null}
                                                        {(svc.price_amount != null || svc.base_price != null) && `₹${Number(svc.price_amount ?? svc.base_price).toLocaleString()}`}
                                                        {svc.price_unit && ` / ${svc.price_unit}`}
                                                    </p>
                                                </div>
                                                <a href={`/admin/services/${svc.id}/edit`} className="text-primary font-medium text-sm hover:underline">Edit</a>
                                                <button type="button" onClick={() => handleDeleteService(svc.id)} className="text-red-600 hover:text-red-700 text-sm font-medium">Delete</button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    </TabsContent>

                    <TabsContent value="gallery">
                    <div className="rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark mb-6">
                        <div className="border-b border-stroke px-6 py-4 dark:border-strokedark bg-gradient-to-r from-amber-50 to-white dark:from-amber-950 dark:to-boxdark">
                            <h3 className="text-lg font-semibold text-black dark:text-white">Gallery</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Images uploaded from the vendor app or here. Shown on the consumer app vendor profile. Max 12 images.
                            </p>
                        </div>
                        <div className="p-6">
                            <label className={labelClass}>Add image</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleGalleryUpload}
                                disabled={uploadingGallery || (Array.isArray(formData.gallery_urls) && formData.gallery_urls.length >= 12)}
                                className={inputClass + ' file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white'}
                            />
                            {uploadingGallery && <p className="mt-2 text-sm text-blue-600">Uploading...</p>}
                            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {(Array.isArray(formData.gallery_urls) ? formData.gallery_urls : []).map((url: string, idx: number) => (
                                    <div key={`${url}-${idx}`} className="relative group rounded-lg border border-stroke dark:border-strokedark overflow-hidden">
                                        <AdminImage url={url} alt="" className="h-36 w-full object-cover" placeholderClassName="h-36 w-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 text-xs" />
                                        <button
                                            type="button"
                                            onClick={() => removeGalleryImage(idx)}
                                            className="absolute top-2 right-2 rounded bg-red-600 text-white text-xs px-2 py-1 opacity-90 hover:opacity-100"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {(!formData.gallery_urls || formData.gallery_urls.length === 0) && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">No gallery images yet.</p>
                            )}
                        </div>
                    </div>
                    </TabsContent>

                    {/* Tab: KYC */}
                    <TabsContent value="kyc">
                    <div className="rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark mb-6">
                        <div className="border-b border-stroke px-6 py-4 dark:border-strokedark bg-gradient-to-r from-orange-50 to-white dark:from-orange-950 dark:to-boxdark">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-black dark:text-white flex items-center gap-2">
                                        <Shield size={20} /> Aadhaar KYC Verification
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Verify vendor identity via Aadhaar OTP, just like the vendor mobile app.
                                    </p>
                                </div>
                                {(aadhaarVerified || formData.is_verified) && (
                                    <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold dark:bg-green-900 dark:text-green-300">
                                        <CheckCircle2 size={14} /> Verified
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <label className={labelClass}>Aadhaar Number</label>
                                    <input
                                        type="text"
                                        value={formData.aadhaar_number || ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 12)
                                            handleChange('aadhaar_number', val)
                                        }}
                                        placeholder="Enter 12-digit Aadhaar number"
                                        maxLength={12}
                                        className={inputClass}
                                    />
                                    {formData.aadhaar_number && formData.aadhaar_number.length > 0 && formData.aadhaar_number.length !== 12 && (
                                        <p className="text-xs text-orange-500 mt-1">{formData.aadhaar_number.length}/12 digits entered</p>
                                    )}
                                </div>

                                <div className="flex items-end gap-3">
                                    {!aadhaarOtpSent && !aadhaarVerified && (
                                        <button
                                            type="button"
                                            onClick={handleGenerateAadhaarOTP}
                                            disabled={aadhaarGenerating || !formData.aadhaar_number || formData.aadhaar_number.length !== 12}
                                            className="px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                        >
                                            {aadhaarGenerating ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                                            {aadhaarGenerating ? 'Sending OTP...' : 'Generate OTP'}
                                        </button>
                                    )}
                                    {aadhaarVerified && formData.is_verified && (
                                        <button
                                            type="button"
                                            onClick={() => { setAadhaarVerified(false); setAadhaarOtpSent(false); setAadhaarOtp(''); setAadhaarReferenceId(null); setAadhaarError('') }}
                                            className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all text-sm dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                        >
                                            Re-verify
                                        </button>
                                    )}
                                </div>

                                {/* OTP Input */}
                                {aadhaarOtpSent && !aadhaarVerified && (
                                    <>
                                        <div>
                                            <label className={labelClass}>Enter OTP (6 digits)</label>
                                            <input
                                                type="text"
                                                value={aadhaarOtp}
                                                onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                placeholder="Enter 6-digit OTP"
                                                maxLength={6}
                                                className={inputClass}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">OTP has been sent to the Aadhaar-linked mobile number</p>
                                        </div>
                                        <div className="flex items-end gap-3">
                                            <button
                                                type="button"
                                                onClick={handleVerifyAadhaarOTP}
                                                disabled={aadhaarVerifying || aadhaarOtp.length !== 6}
                                                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                            >
                                                {aadhaarVerifying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                {aadhaarVerifying ? 'Verifying...' : 'Verify OTP'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setAadhaarOtpSent(false); setAadhaarOtp(''); setAadhaarReferenceId(null); setAadhaarError('') }}
                                                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                            >
                                                Resend
                                            </button>
                                        </div>
                                    </>
                                )}

                                {/* Aadhaar Images */}
                                <div>
                                    <label className={labelClass}>Aadhaar Front Image</label>
                                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'aadhaar_front_url')} disabled={uploadingFront} className={inputClass + ' file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90'} />
                                    {uploadingFront && <p className="mt-1 text-sm text-blue-600">Uploading...</p>}
                                    {formData.aadhaar_front_url && !uploadingFront && <p className="mt-1 text-sm text-green-600">File uploaded</p>}
                                </div>
                                <div>
                                    <label className={labelClass}>Aadhaar Back Image</label>
                                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'aadhaar_back_url')} disabled={uploadingBack} className={inputClass + ' file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90'} />
                                    {uploadingBack && <p className="mt-1 text-sm text-blue-600">Uploading...</p>}
                                    {formData.aadhaar_back_url && !uploadingBack && <p className="mt-1 text-sm text-green-600">File uploaded</p>}
                                </div>
                            </div>

                            {/* Error / success messages */}
                            {aadhaarError && (
                                <div className="mt-4 flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                                    <AlertCircle size={16} /> <span className="text-sm">{aadhaarError}</span>
                                </div>
                            )}
                            {aadhaarVerified && (
                                <div className="mt-4 flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg border border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                                    <CheckCircle2 size={16} /> <span className="text-sm font-semibold">Aadhaar verified successfully!</span>
                                </div>
                            )}

                            {/* Manual verification toggle */}
                            <div className="mt-6 pt-4 border-t border-stroke dark:border-strokedark">
                                <div className="flex items-center space-x-3 rounded-lg border border-stroke bg-gray-50 px-4 py-3 dark:border-strokedark dark:bg-gray-900">
                                    <Switch
                                        checked={formData.is_verified || false}
                                        onCheckedChange={(checked) => handleChange('is_verified', checked)}
                                    />
                                    <span className="text-sm font-medium text-black dark:text-white">
                                        {formData.is_verified ? 'Identity Verified' : 'Not Verified'}
                                    </span>
                                    <span className="text-xs text-gray-500 ml-2">(Can also be manually set without OTP flow)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    </TabsContent>

                    {/* Tab: Status */}
                    <TabsContent value="status">
                    {/* Section 4: Status */}
                    <div className="rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark mb-6">
                        <div className="border-b border-stroke px-6 py-4 dark:border-strokedark bg-gradient-to-r from-green-50 to-white dark:from-green-950 dark:to-boxdark">
                            <h3 className="text-lg font-semibold text-black dark:text-white">Status</h3>
                        </div>
                        <div className="p-6">
                            <div className="flex items-center space-x-3 rounded-lg border border-stroke bg-gray-50 px-4 py-3 dark:border-strokedark dark:bg-gray-900">
                                <Switch
                                    checked={formData.status || false}
                                    onCheckedChange={(checked) => handleChange('status', checked)}
                                />
                                <span className="text-sm font-medium text-black dark:text-white">
                                    {formData.status ? 'Active' : 'Pending'}
                                </span>
                            </div>
                        </div>
                    </div>
                    </TabsContent>

                    </Tabs>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full justify-center rounded-lg bg-blue-600 p-4 font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                    </button>
                </form>
            </div>
            <ConfirmDialog
                open={!!deleteServiceTarget}
                onOpenChange={(open) => !open && setDeleteServiceTarget(null)}
                title="Delete Service"
                description="Are you sure you want to delete this service? This action cannot be undone."
                onConfirm={confirmDeleteService}
            />
        </DefaultLayout>
    )
}
