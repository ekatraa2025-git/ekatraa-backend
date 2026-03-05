-- Add Basic tier price column to offerable_services (first tier: Basic, then Classic Value, Signature, etc.)
ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS price_basic DECIMAL(12, 2);
COMMENT ON COLUMN offerable_services.price_basic IS 'Basic tier price';
