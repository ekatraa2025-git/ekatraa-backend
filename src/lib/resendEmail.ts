/**
 * Send transactional email via Resend HTTP API (no extra npm dependency).
 * Set RESEND_API_KEY and RESEND_FROM_EMAIL in production.
 */
export async function sendResendEmail(params: {
    to: string;
    subject: string;
    html: string;
    bcc?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        return { ok: false, error: 'RESEND_API_KEY not configured' };
    }
    const from =
        process.env.RESEND_FROM_EMAIL || 'Ekatraa <onboarding@resend.dev>';
    const body: Record<string, unknown> = {
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
    };
    if (params.bcc) {
        body.bcc = [params.bcc];
    }
    const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        const err = await r.text();
        return { ok: false, error: err || r.statusText };
    }
    return { ok: true };
}

function escapeHtml(s: string) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export { escapeHtml };
