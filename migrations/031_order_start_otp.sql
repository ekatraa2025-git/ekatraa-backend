-- 031_order_start_otp.sql
-- OTP for vendor start-of-work: vendor requests start -> customer sees OTP in app -> vendor confirms -> order becomes in_progress.

BEGIN;

CREATE TABLE IF NOT EXISTS order_start_otp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    otp TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_start_otp_order_id ON order_start_otp(order_id);
CREATE INDEX IF NOT EXISTS idx_order_start_otp_expires_at ON order_start_otp(expires_at);

COMMIT;
