-- When vendor confirms start / completion OTPs, these record the actual event times for the customer app and reporting.

BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS work_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.work_started_at IS 'Set when vendor confirms start-work OTP (in_progress)';
COMMENT ON COLUMN orders.work_completed_at IS 'Set when vendor confirms completion OTP (completed)';

COMMIT;
