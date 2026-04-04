-- Per-tier optional "sub variety" labels (admin catalog), parallel to qty_label_*.
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS sub_variety_basic TEXT;
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS sub_variety_classic_value TEXT;
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS sub_variety_signature TEXT;
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS sub_variety_prestige TEXT;
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS sub_variety_royal TEXT;
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS sub_variety_imperial TEXT;
