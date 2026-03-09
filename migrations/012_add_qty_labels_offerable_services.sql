-- 012_add_qty_labels_offerable_services.sql
-- Adds configurable quantity/text labels per pricing tier on offerable_services.
-- These labels appear alongside prices in the app (e.g. "Upto 100", "1 set", etc.)

BEGIN;

ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS qty_label_basic TEXT;
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS qty_label_classic_value TEXT;
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS qty_label_signature TEXT;
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS qty_label_prestige TEXT;
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS qty_label_royal TEXT;
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS qty_label_imperial TEXT;

COMMIT;
