-- 019_order_completion_otp.sql
-- Store OTP for order completion verification. Vendor requests completion -> OTP sent to customer -> vendor enters OTP to confirm.

BEGIN;

CREATE TABLE IF NOT EXISTS order_completion_otp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    otp TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_completion_otp_order_id ON order_completion_otp(order_id);
CREATE INDEX IF NOT EXISTS idx_order_completion_otp_expires_at ON order_completion_otp(expires_at);

COMMIT;
