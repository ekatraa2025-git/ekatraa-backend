-- Link vendor portfolio line to catalog offerable service (for strict admin allocation).
ALTER TABLE services ADD COLUMN IF NOT EXISTS catalog_service_id UUID REFERENCES offerable_services(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_services_catalog_service_id ON services (catalog_service_id) WHERE catalog_service_id IS NOT NULL;
