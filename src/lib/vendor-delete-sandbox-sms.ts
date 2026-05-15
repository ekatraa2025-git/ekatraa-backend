import { sandboxAuthorizedPost } from '@/lib/sandbox-client'

type SandboxSmsResponseBody = {
    code?: number
    message?: string
    data?: { message?: string }
}

const DEFAULT_REASON =
    'Ekatraa vendor account deletion verification — one-time OTP delivery to registered mobile.'

/**
 * Sends vendor deletion OTP over Sandbox-authenticated SMS API.
 *
 * Configure:
 * - `SANDBOX_VENDOR_DELETE_SMS_PATH` — path under SANDBOX_HOST (e.g. `/communication/sms/send`) or absolute URL.
 * - Optional `SANDBOX_VENDOR_DELETE_SMS_JSON` — JSON template with placeholders `{{mobile}}`, `{{otp}}`, `{{reason}}`.
 *   Use when your Sandbox product requires `@entity` or extra fields (same pattern as KYC OTP bodies).
 * - Optional `SANDBOX_VENDOR_DELETE_SMS_REASON` — replaces default reason string (still injected as {{reason}} in templates).
 *
 * If `SANDBOX_VENDOR_DELETE_SMS_JSON` is omitted, sends a minimal `{ mobile_number, otp, consent, reason }` body.
 */
export async function sendVendorDeletionOtpSmsSandbox(params: {
    phoneDigits10: string
    otp: string
}): Promise<{ ok: boolean; detail?: string }> {
    const path = process.env.SANDBOX_VENDOR_DELETE_SMS_PATH?.trim()
    if (!path) {
        return { ok: false, detail: 'sandbox_sms_unconfigured' }
    }

    const mobile = params.phoneDigits10
    const otp = params.otp
    const reason = process.env.SANDBOX_VENDOR_DELETE_SMS_REASON?.trim() || DEFAULT_REASON

    let body: unknown
    try {
        const tpl = process.env.SANDBOX_VENDOR_DELETE_SMS_JSON?.trim()
        if (tpl) {
            const replaced = tpl
                .replace(/\{\{\s*mobile\s*\}\}/gi, mobile)
                .replace(/\{\{\s*otp\s*\}\}/gi, otp)
                .replace(/\{\{\s*reason\s*\}\}/gi, reason.replace(/\\/g, '\\\\').replace(/"/g, '\\"'))
            body = JSON.parse(replaced)
        } else {
            body = {
                mobile_number: mobile,
                otp,
                consent: 'Y',
                reason,
            }
        }
    } catch {
        return { ok: false, detail: 'invalid_sandbox_sms_json_template' }
    }

    try {
        const res = await sandboxAuthorizedPost(path, body)
        const raw = await res.text()
        let parsed: SandboxSmsResponseBody | null = null
        try {
            parsed = JSON.parse(raw) as SandboxSmsResponseBody
        } catch {
            /* non-json body */
        }

        if (!res.ok) {
            console.warn('[Sandbox SMS vendor-delete]', res.status, raw.slice(0, 600))
            return { ok: false, detail: raw.slice(0, 280) }
        }

        if (parsed && typeof parsed.code === 'number' && parsed.code !== 200) {
            console.warn('[Sandbox SMS vendor-delete] body code', parsed.code, raw.slice(0, 400))
            return { ok: false, detail: parsed.message || raw.slice(0, 280) }
        }

        return { ok: true }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('[Sandbox SMS vendor-delete]', msg)
        return { ok: false, detail: msg }
    }
}
