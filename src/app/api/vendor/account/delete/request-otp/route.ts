import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'
import { normalizePhoneDigits } from '@/lib/phone-normalize'
import {
    generateVendorDeletionOtp,
    upsertVendorDeletionOtp,
} from '@/lib/vendor-compliance-delete-otp'
import { notifyVendorAccountDeletionOtp } from '@/lib/notifications'
import { deliverVendorDeletionOtpSms } from '@/lib/twilio-sms'

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

/** Owner-only: send OTP for vendor account deletion (push + Twilio SMS when configured). */
export async function POST(req: Request) {
    try {
        const auth = await getVendorFromRequest(req)
        if (auth.error) return auth.error

        if (auth.isTeamMember) {
            return NextResponse.json(
                { error: 'Only the business owner can delete this vendor account.' },
                { status: 403 }
            )
        }

        if (!rateLimitOk(auth.vendorId)) {
            return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
        }

        const { data: vendor, error } = await supabase
            .from('vendors')
            .select('phone')
            .eq('id', auth.vendorId)
            .maybeSingle()

        if (error || !vendor) {
            return NextResponse.json({ error: 'Vendor profile not found.' }, { status: 404 })
        }

        const digits = normalizePhoneDigits(vendor.phone as string)
        if (digits.length !== 10) {
            return NextResponse.json(
                { error: 'Your profile needs a valid 10-digit registered mobile before deletion.' },
                { status: 400 }
            )
        }

        const otp = generateVendorDeletionOtp()
        await upsertVendorDeletionOtp(digits, otp)
        await notifyVendorAccountDeletionOtp({ vendorIds: [auth.vendorId], otp })
        void deliverVendorDeletionOtpSms(digits, otp)

        return NextResponse.json({
            ok: true,
            message:
                'If your registered number is valid, a verification code was sent by SMS (Twilio when configured) and to your vendor devices.',
        })
    } catch (e) {
        console.error('[vendor account delete request-otp]', e)
        return NextResponse.json({ error: 'Could not send verification code.' }, { status: 500 })
    }
}
