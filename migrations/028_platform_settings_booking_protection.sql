-- Admin-configurable Booking Protection pricing; order columns for persisted amounts.

BEGIN;

CREATE TABLE IF NOT EXISTS platform_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    booking_protection_mode TEXT NOT NULL DEFAULT 'none',
    booking_protection_fixed_inr BIGINT NOT NULL DEFAULT 0,
    booking_protection_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS booking_protection BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS protection_amount NUMERIC DEFAULT 0;

COMMIT;
