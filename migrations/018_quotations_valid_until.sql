-- Run this migration to add valid_until column to quotations.
-- After running, uncomment valid_until in src/app/api/vendor/quotations/route.ts quotationData.
BEGIN;

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;

COMMIT;
