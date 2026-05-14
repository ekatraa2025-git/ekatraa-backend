-- OTP challenges for vendor self-service account deletion (web + app).
-- Access only via service role from Next.js API routes.

CREATE TABLE IF NOT EXISTS public.vendor_account_deletion_otp (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_digits text NOT NULL,
    otp_code text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_account_deletion_otp_phone
    ON public.vendor_account_deletion_otp (phone_digits);

ALTER TABLE public.vendor_account_deletion_otp ENABLE ROW LEVEL SECURITY;
