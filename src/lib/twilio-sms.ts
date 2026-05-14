/**
 * Transactional SMS via Twilio Programmable Messaging (REST).
 * Align env vars with Twilio + typical Supabase Auth phone (Twilio) setups:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER          — sender number (E.164), unless using messaging service
 *   TWILIO_MESSAGING_SERVICE_SID — optional; if set, used instead of From (recommended for scaling)
 *
 * Optional: TWILIO_SMS_DEFAULT_COUNTRY_CODE — default "91" when storing only 10-digit national numbers.
 */

function twilioSmsConfigured(): boolean {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
    const token = process.env.TWILIO_AUTH_TOKEN?.trim()
    const from = process.env.TWILIO_PHONE_NUMBER?.trim()
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
    return !!(sid && token && (from || messagingServiceSid))
}

/** Build E.164 for India-style DB storage (last 10 digits). Override country via TWILIO_SMS_DEFAULT_COUNTRY_CODE. */
export function national10ToE164(national10: string): string {
    const digits = national10.replace(/\D/g, '').slice(-10)
    if (digits.length !== 10) return ''
    const cc = (process.env.TWILIO_SMS_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '')
    return cc ? `+${cc}${digits}` : `+${digits}`
}

export type TwilioSmsResult = { ok: true } | { ok: false; error: string }

/**
 * POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 */
export async function sendTwilioProgrammableSms(params: {
    toE164: string
    body: string
}): Promise<TwilioSmsResult> {
    if (!twilioSmsConfigured()) {
        return { ok: false, error: 'Twilio SMS env not fully configured' }
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID!.trim()
    const authToken = process.env.TWILIO_AUTH_TOKEN!.trim()
    const from = process.env.TWILIO_PHONE_NUMBER?.trim()
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()

    const to = params.toE164.trim()
    if (!to.startsWith('+')) {
        return { ok: false, error: 'Recipient must be E.164 (e.g. +9198…)' }
    }

    const form = new URLSearchParams()
    form.set('To', to)
    form.set('Body', params.body)
    if (messagingServiceSid) {
        form.set('MessagingServiceSid', messagingServiceSid)
    } else {
        form.set('From', from!)
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    try {
        const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: form.toString(),
            }
        )

        if (res.ok) {
            return { ok: true }
        }

        const errText = await res.text().catch(() => '')
        let message = errText.slice(0, 300)
        try {
            const j = JSON.parse(errText) as { message?: string }
            if (j?.message) message = j.message
        } catch {
            /* keep raw */
        }
        return { ok: false, error: `${res.status}: ${message}` }
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Twilio request failed'
        return { ok: false, error: msg }
    }
}

async function postComplianceSmsWebhook(phoneDigits10: string, otp: string): Promise<boolean> {
    const url = process.env.COMPLIANCE_VENDOR_DELETE_SMS_WEBHOOK_URL?.trim()
    if (!url) return false
    try {
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_e164: national10ToE164(phoneDigits10),
                otp,
                purpose: 'vendor_account_deletion',
            }),
        })
        return r.ok
    } catch {
        return false
    }
}

/**
 * Vendor delete OTP: Twilio SMS when configured (same stack as Auth transactional SMS), else optional webhook.
 * Fire-and-forget from route handlers; logs on failure.
 */
export async function deliverVendorDeletionOtpSms(phoneDigits10: string, otp: string): Promise<void> {
    const to = national10ToE164(phoneDigits10)
    if (!to) {
        console.warn('[vendor deletion sms] invalid national number for SMS')
        return
    }

    const body =
        process.env.TWILIO_VENDOR_DELETE_SMS_BODY_TEMPLATE?.replace(/\{otp\}/g, otp) ||
        `Ekatraa: Your vendor account deletion code is ${otp}. Valid 10 minutes. Do not share.`

    if (twilioSmsConfigured()) {
        const result = await sendTwilioProgrammableSms({ toE164: to, body })
        if (result.ok) return
        console.error('[vendor deletion sms] Twilio failed:', result.error)
    }

    const webhookOk = await postComplianceSmsWebhook(phoneDigits10, otp)
    if (!webhookOk && !twilioSmsConfigured()) {
        console.warn(
            '[vendor deletion sms] No Twilio credentials and webhook failed or unset; OTP only via push.'
        )
    }
}
