/**
 * Columns allowed on public.vendors for API inserts/patches.
 * Prevents stray keys (e.g. typos) from reaching PostgREST and breaking schema cache.
 */
export const VENDOR_WRITABLE_KEYS = new Set<string>([
  'business_name',
  'category',
  'category_id',
  'owner_name',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'service_area',
  'description',
  'logo_url',
  'gallery_urls',
  'aadhaar_number',
  'aadhaar_front_url',
  'aadhaar_back_url',
  'is_verified',
  'aadhaar_verified',
  'status',
  'is_active',
  'gst_number',
  'pan_number',
  'bank_name',
  'account_number',
  'ifsc_code',
  'upi_id',
  'user_id',
])

export function pickVendorPayload(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(input)) {
    if (key === 'is_activee') continue
    if (VENDOR_WRITABLE_KEYS.has(key)) {
      out[key] = input[key]
    }
  }
  return out
}
