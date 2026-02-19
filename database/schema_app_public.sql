-- eKatRaa Backend - Public App Schema (Banners, Featured Venues, App Service Catalog)
-- Run this in Supabase SQL Editor after the main schema (cities, event_types, venues, etc.)

-- =====================================================
-- 1. BANNERS TABLE (if not already created by main schema)
-- =====================================================
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    link_type VARCHAR(50) DEFAULT 'external',
    link_id UUID,
    banner_type VARCHAR(50) DEFAULT 'promotional',
    display_order INTEGER DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_order ON banners(display_order);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active banners" ON banners;
CREATE POLICY "Public can view active banners" ON banners
    FOR SELECT USING (is_active = true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()));

-- =====================================================
-- 2. ADD is_featured TO VENUES (run only if column missing)
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'venues' AND column_name = 'is_featured'
    ) THEN
        ALTER TABLE venues ADD COLUMN is_featured BOOLEAN DEFAULT false;
        CREATE INDEX IF NOT EXISTS idx_venues_featured ON venues(is_featured) WHERE is_featured = true;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'venues' AND column_name = 'display_order'
    ) THEN
        ALTER TABLE venues ADD COLUMN display_order INTEGER DEFAULT 0;
    END IF;
END $$;

-- =====================================================
-- 3. APP SERVICE CATALOG - Services shown per get-together type
-- =====================================================
CREATE TABLE IF NOT EXISTS app_service_catalog (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10),
    event_types TEXT[] NOT NULL DEFAULT '{}',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_service_catalog_event_types ON app_service_catalog USING GIN(event_types);

ALTER TABLE app_service_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view app service catalog" ON app_service_catalog;
CREATE POLICY "Public can view app service catalog" ON app_service_catalog
    FOR SELECT USING (is_active = true);

-- Seed app services (event type ids: wedding, janayu, social, birthday, corporate, funeral)
INSERT INTO app_service_catalog (id, name, icon, event_types, display_order) VALUES
    ('1', 'Venue', '🏰', ARRAY['wedding','janayu','social','birthday','corporate','funeral'], 1),
    ('2', 'Catering', '🍽️', ARRAY['wedding','janayu','social','birthday','corporate','funeral'], 2),
    ('3', 'Decor', '✨', ARRAY['wedding','janayu','social','birthday','corporate'], 3),
    ('4', 'Photo/Video', '📸', ARRAY['wedding','birthday','janayu','corporate'], 4),
    ('5', 'Music/DJ', '🎵', ARRAY['wedding','birthday','social'], 5),
    ('6', 'Makeup', '💄', ARRAY['wedding','janayu'], 6),
    ('7', 'Mehendi', '🎨', ARRAY['wedding'], 7),
    ('8', 'Pandit/Priest', '🕉️', ARRAY['wedding','janayu','funeral'], 8),
    ('9', 'Sound & Lights', '🔊', ARRAY['wedding','social','corporate','birthday'], 9),
    ('10', 'Transport', '🚌', ARRAY['wedding','corporate','funeral'], 10)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    event_types = EXCLUDED.event_types,
    display_order = EXCLUDED.display_order;

-- Sample banners (run once; table may have no unique constraint on content)
INSERT INTO banners (id, title, subtitle, image_url, banner_type, display_order)
SELECT gen_random_uuid(), 'Wedding Season Special', 'Book now for exclusive discounts', 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800', 'promotional', 1
WHERE NOT EXISTS (SELECT 1 FROM banners LIMIT 1);

INSERT INTO banners (id, title, subtitle, image_url, banner_type, display_order)
SELECT gen_random_uuid(), 'Success Story: Ravi & Priya', 'A beautiful wedding organized by eKatRaa', 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800', 'success_story', 2
WHERE (SELECT COUNT(*) FROM banners) < 2;

INSERT INTO banners (id, title, subtitle, image_url, banner_type, display_order)
SELECT gen_random_uuid(), 'Corporate Events', 'Professional event management for businesses', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800', 'promotional', 3
WHERE (SELECT COUNT(*) FROM banners) < 3;
