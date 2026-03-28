import { NextRequest, NextResponse } from 'next/server';
import { sendResendEmail, escapeHtml } from '@/lib/resendEmail';

type Body = {
    vendor_email?: string | null;
    vendor_id?: string | null;
    accepted_at?: string;
    terms_version?: string;
    device_info?: string;
};

export async function POST(req: NextRequest) {
    const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        '';

    let body: Body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const vendor_email =
        typeof body.vendor_email === 'string' ? body.vendor_email.trim() : '';
    const vendor_id =
        typeof body.vendor_id === 'string' && body.vendor_id
            ? body.vendor_id
            : null;
    const accepted_at =
        typeof body.accepted_at === 'string' ? body.accepted_at : '';
    const terms_version =
        typeof body.terms_version === 'string' ? body.terms_version : '';
    const device_info =
        typeof body.device_info === 'string' ? body.device_info : '';

    if (!accepted_at || !terms_version) {
        return NextResponse.json(
            { error: 'accepted_at and terms_version are required' },
            { status: 400 }
        );
    }

    let emailed = false;
    if (vendor_email.includes('@')) {
        const html = `
<p>You accepted the <strong>Ekatraa Vendor Terms &amp; Conditions</strong>.</p>
<table cellpadding="8" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
  <tr><td style="border:1px solid #ccc;"><strong>Accepted at (ISO UTC)</strong></td><td style="border:1px solid #ccc;">${escapeHtml(accepted_at)}</td></tr>
  <tr><td style="border:1px solid #ccc;"><strong>Terms version</strong></td><td style="border:1px solid #ccc;">${escapeHtml(terms_version)}</td></tr>
  <tr><td style="border:1px solid #ccc;"><strong>IP (as seen by server)</strong></td><td style="border:1px solid #ccc;">${escapeHtml(ip || '—')}</td></tr>
  <tr><td style="border:1px solid #ccc;"><strong>Device / app (from client)</strong></td><td style="border:1px solid #ccc;">${escapeHtml(device_info || '—')}</td></tr>
  <tr><td style="border:1px solid #ccc;"><strong>Vendor account ID</strong></td><td style="border:1px solid #ccc;">${escapeHtml(vendor_id || '—')}</td></tr>
</table>
<p style="font-family:sans-serif;font-size:13px;color:#444;">Please retain this email for your records. For questions, contact <a href="mailto:grievance@ekatraa.in">grievance@ekatraa.in</a>.</p>`;

        const result = await sendResendEmail({
            to: vendor_email,
            subject: 'Ekatraa — copy of Vendor Terms acceptance',
            html,
            bcc: process.env.TERMS_ACCEPTANCE_BCC_EMAIL || undefined,
        });
        if (result.ok) {
            emailed = true;
        } else {
            console.error('[vendor/terms-acceptance] Resend failed:', result.error);
        }
    }

    return NextResponse.json({ ok: true, emailed });
}
