import { NextResponse } from 'next/server'
import { z } from 'zod'
import { planningCorsHeaders } from '@/lib/ai-planning-cors'
import { normalizePhoneDigits } from '@/lib/phone-normalize'
import { findVendorIdsByNormalizedPhone } from '@/lib/vendor-compliance-delete'
import {
    generateVendorDeletionOtp,
    upsertVendorDeletionOtp,
} from '@/lib/vendor-compliance-delete-otp'
import { notifyVendorAccountDeletionOtp } from '@/lib/notifications'
import { deliverVendorDeletionOtpSms } from '@/lib/twilio-sms'

const bodySchema = z.object({
    phone: z.string().min(8).max(32),
})

const attempts = new Map<string, number[]>()
const RATE_MAX = 8
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
 * POST /api/public/compliance/vendor-delete/request-otp
 * Sends a 6-digit OTP via vendor push + Twilio SMS when TWILIO_* is set (same pattern as Auth OTP).
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
            return NextResponse.json({ error: 'Invalid phone.' }, { status: 400, headers: cors })
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

        const vendorIds = await findVendorIdsByNormalizedPhone(digits)

        if (vendorIds.length > 0) {
            const otp = generateVendorDeletionOtp()
            await upsertVendorDeletionOtp(digits, otp)
            await notifyVendorAccountDeletionOtp({ vendorIds, otp })
            void deliverVendorDeletionOtpSms(digits, otp)
        }

        return NextResponse.json(
            {
                ok: true,
                message:
                    'If a vendor account exists for that number, a verification code was sent by SMS (Twilio when configured) and to registered vendor devices.',
            },
            { status: 200, headers: cors }
        )
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed'
        console.error('[compliance vendor-delete request-otp]', msg)
        return NextResponse.json({ error: 'Could not send verification code.' }, { status: 500, headers: cors })
    }
}
