-- =====================================================
-- Ekatraa Service Catalog Schema
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Service Subcategories (linked to vendor_categories)
CREATE TABLE IF NOT EXISTS service_subcategories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES vendor_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Service Stocks (items with tiered pricing, linked to subcategories)
CREATE TABLE IF NOT EXISTS service_stocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subcategory_id UUID NOT NULL REFERENCES service_subcategories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_basic NUMERIC DEFAULT 0,
    price_standard NUMERIC DEFAULT 0,
    price_premium NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Service Date Availability (per-service per-date availability tracking)
CREATE TABLE IF NOT EXISTS service_date_availability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_id UUID NOT NULL,
    service_id UUID NOT NULL,
    availability_date DATE NOT NULL,
    is_available BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id, service_id, availability_date)
);

-- 4. Add new columns to existing services table (nullable for backward compatibility)
ALTER TABLE services ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pricing_type TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS stock_id UUID;

-- =====================================================
-- Row Level Security Policies
-- =====================================================

-- Enable RLS
ALTER TABLE service_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_date_availability ENABLE ROW LEVEL SECURITY;

-- Subcategories: Public read access
CREATE POLICY "Allow public read on subcategories" ON service_subcategories
    FOR SELECT USING (true);

-- Stocks: Public read access
CREATE POLICY "Allow public read on stocks" ON service_stocks
    FOR SELECT USING (true);

-- Service Date Availability: Open access (vendor app uses authenticated Supabase client)
CREATE POLICY "Allow select on availability" ON service_date_availability
    FOR SELECT USING (true);

CREATE POLICY "Allow insert on availability" ON service_date_availability
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update on availability" ON service_date_availability
    FOR UPDATE USING (true);

CREATE POLICY "Allow delete on availability" ON service_date_availability
    FOR DELETE USING (true);

-- =====================================================
-- Indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_subcategories_category ON service_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_stocks_subcategory ON service_stocks(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_availability_vendor_date ON service_date_availability(vendor_id, availability_date);
CREATE INDEX IF NOT EXISTS idx_availability_service ON service_date_availability(service_id);

-- =====================================================
-- Sample Data: Makeup Artist and Salon
-- =====================================================
-- Uncomment and run the lines below AFTER creating the tables
-- to seed the sample data provided:

-- INSERT INTO vendor_categories (name) VALUES ('Makeup Artist and Salon')
--     ON CONFLICT DO NOTHING;

-- WITH cat AS (SELECT id FROM vendor_categories WHERE name = 'Makeup Artist and Salon' LIMIT 1)
-- INSERT INTO service_subcategories (category_id, name) VALUES
--     ((SELECT id FROM cat), 'Local Salons');

-- WITH subcat AS (SELECT id FROM service_subcategories WHERE name = 'Local Salons' LIMIT 1)
-- INSERT INTO service_stocks (subcategory_id, name, price_basic, price_standard, price_premium) VALUES
--     ((SELECT id FROM subcat), 'Bridal', 15000, 25000, 50000),
--     ((SELECT id FROM subcat), 'Light Make Up', 300, 500, 800),
--     ((SELECT id FROM subcat), 'Eye Fix', 200, 300, 500),
--     ((SELECT id FROM subcat), 'Hair Touch Up', 200, 300, 500),
--     ((SELECT id FROM subcat), 'Quick Hair Style', 500, 800, 1200),
--     ((SELECT id FROM subcat), 'Dupata or Saree Fixing', 200, 300, 500),
--     ((SELECT id FROM subcat), 'Instant Glow', 300, 500, 1000),
--     ((SELECT id FROM subcat), 'Groom or Male Grooming', 500, 800, 1200);
