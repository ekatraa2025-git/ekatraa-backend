-- Optional: add tier pricing columns to offerable_services (Classic, Signature, Prestige, Royal, Imperial)
-- Run after 002. Safe if columns already exist (use IF NOT EXISTS where supported).

ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS price_classic_value DECIMAL(12, 2);
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS price_signature DECIMAL(12, 2);
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS price_prestige DECIMAL(12, 2);
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS price_royal DECIMAL(12, 2);
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS price_imperial DECIMAL(12, 2);

COMMENT ON COLUMN offerable_services.price_classic_value IS 'Classic Value tier price';
COMMENT ON COLUMN offerable_services.price_signature IS 'Signature tier price';
COMMENT ON COLUMN offerable_services.price_prestige IS 'Prestige tier price';
COMMENT ON COLUMN offerable_services.price_royal IS 'Royal tier price';
COMMENT ON COLUMN offerable_services.price_imperial IS 'Imperial tier price';
