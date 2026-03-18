/**
 * POST /api/admin/quotations/vendor-submit
 * Fallback endpoint for vendor quotation submission when /api/vendor/quotations returns 404.
 * Uses same logic as vendor quotations - requires vendor Bearer token.
 */
export { POST } from '@/app/api/vendor/quotations/route'
