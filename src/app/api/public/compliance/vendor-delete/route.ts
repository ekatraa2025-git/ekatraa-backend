import { NextResponse } from 'next/server'
import { z } from 'zod'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'
import { normalizePhoneDigits } from '@/lib/phone-normalize'
import {
    findVendorIdsByNormalizedPhone,
    purgeVendorBusinessAccount,
} from '@/lib/vendor-compliance-delete'
import {
    clearVendorDeletionOtpForPhone,
    validateVendorDeletionOtp,
} from '@/lib/vendor-compliance-delete-otp'

const bodySchema = z.object({
    phone: z.string().min(8).max(32),
    otp: z.string().regex(/^\d{6}$/),
    confirmation: z.literal('DELETE MY VENDOR ACCOUNT'),
})

/**
 * Rate limit: max attempts per normalized phone within the window (best-effort, in-memory).
 */
const attempts = new Map<string, number[]>()
const RATE_MAX = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

function rateLimitOk(key: string): boolean {
    const now = Date.now()
    const fresh = (attempts.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS)
    if (fresh.length >= RATE_MAX) return false
    fresh.push(now)
    attempts.set(key, fresh)
    return true
}

/**
 * Vendor self-service erasure (compliance). Uses service role; never reveals whether a phone matched.
 *
 * POST /api/public/compliance/vendor-delete
 * Body: { phone, otp (6 digits), confirmation: "DELETE MY VENDOR ACCOUNT" }
 */
export async function OPTIONS(req: Request) {
    return new NextResponse(null, { status: 204, headers: planningCorsHeaders(req) })
}

export async function POST(req: Request) {
    const cors = planningCorsHeaders(req)
    try {
        const json = await req.json()
        const parsed = bodySchema.safeParse(json)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request. Check phone, 6-digit code, and confirmation phrase.' },
                { status: 400, headers: cors }
            )
        }

        const digits = normalizePhoneDigits(parsed.data.phone)
        if (digits.length !== 10) {
            return NextResponse.json(
                { error: 'Enter a valid 10-digit mobile number (with or without country code).' },
                { status: 400, headers: cors }
            )
        }

        if (!rateLimitOk(digits)) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later or email your privacy contact.' },
                { status: 429, headers: cors }
            )
        }

        const otpOk = await validateVendorDeletionOtp(digits, parsed.data.otp)
        if (!otpOk) {
            return NextResponse.json(
                {
                    error:
                        'Invalid or expired verification code. Request a new code and try again, or email your privacy contact.',
                },
                { status: 400, headers: cors }
            )
        }

        const vendorIds = await findVendorIdsByNormalizedPhone(digits)

        if (vendorIds.length === 0) {
            await clearVendorDeletionOtpForPhone(digits)
            return NextResponse.json(
                {
                    ok: true,
                    message:
                        'If a vendor account exists for that number, it has been erased. This response is the same whether or not a match was found, to protect your privacy.',
                },
                { status: 200, headers: cors }
            )
        }

        for (const vendorId of vendorIds) {
            const { error } = await purgeVendorBusinessAccount(vendorId)
            if (error) {
                console.error('[compliance vendor-delete]', vendorId, error)
                return NextResponse.json(
                    { error: 'Deletion could not be completed. Please contact support with your request.' },
                    { status: 500, headers: cors }
                )
            }
        }

        await clearVendorDeletionOtpForPhone(digits)

        return NextResponse.json(
            {
                ok: true,
                message:
                    'If a vendor account exists for that number, it has been erased. This response is the same whether or not a match was found, to protect your privacy.',
            },
            { status: 200, headers: cors }
        )
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed'
        return NextResponse.json({ error: msg }, { status: 500, headers: planningCorsHeaders(req) })
    }
}
