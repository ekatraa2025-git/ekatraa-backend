import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase/server'
import { getVendorFromRequest } from '@/lib/vendor-auth'
import { resolveVendorOwnerPhoneDigits } from '@/lib/vendor-owner-phone'
import { purgeVendorBusinessAccount } from '@/lib/vendor-compliance-delete'
import { verifyAndClearVendorDeletionOtp } from '@/lib/vendor-compliance-delete-otp'

const bodySchema = z.object({
    otp: z.string().regex(/^\d{6}$/),
    confirmation: z.literal('DELETE MY VENDOR ACCOUNT'),
})

const attempts = new Map<string, number[]>()
const RATE_MAX = 10
const RATE_WINDOW_MS = 60 * 60 * 1000

function rateLimitOk(key: string): boolean {
    const now = Date.now()
    const fresh = (attempts.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS)
    if (fresh.length >= RATE_MAX) return false
    fresh.push(now)
    attempts.set(key, fresh)
    return true
}

/** Owner-only: verify OTP + phrase and purge vendor account. */
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

        const json = await req.json()
        const parsed = bodySchema.safeParse(json)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Enter the 6-digit code and confirmation phrase exactly.' },
                { status: 400 }
            )
        }

        if (!rateLimitOk(auth.vendorId)) {
            return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
        }

        const { data: vendor, error } = await supabase
            .from('vendors')
            .select('phone')
            .eq('id', auth.vendorId)
            .maybeSingle()

        if (error || !vendor) {
            return NextResponse.json({ error: 'Vendor profile not found.' }, { status: 404 })
        }

        const digits = await resolveVendorOwnerPhoneDigits(req, vendor.phone as string | null)
        if (digits.length !== 10) {
            return NextResponse.json({ error: 'Registered mobile is invalid.' }, { status: 400 })
        }

        const otpOk = await verifyAndClearVendorDeletionOtp(digits, parsed.data.otp)
        if (!otpOk) {
            return NextResponse.json(
                { error: 'Invalid or expired verification code. Request a new code.' },
                { status: 400 }
            )
        }

        const { error: purgeErr } = await purgeVendorBusinessAccount(auth.vendorId)
        if (purgeErr) {
            console.error('[vendor account delete confirm]', auth.vendorId, purgeErr)
            return NextResponse.json(
                { error: 'Deletion could not be completed. Contact support.' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            ok: true,
            message:
                'Your vendor account has been erased from Ekatraa. You have been signed out of this session.',
        })
    } catch (e) {
        console.error('[vendor account delete confirm]', e)
        return NextResponse.json({ error: 'Request failed.' }, { status: 500 })
    }
}
