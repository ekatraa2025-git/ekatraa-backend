-- Special catalog flag + global special services + testimonials
-- Run in Supabase SQL Editor.

BEGIN;

ALTER TABLE offerable_services ADD COLUMN IF NOT EXISTS is_special_catalog BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    testimonial_text TEXT,
    video_url TEXT,
    voice_recording_url TEXT,
    image_url TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_active_order ON testimonials (is_active, display_order);

INSERT INTO categories (id, name, display_order, is_active)
VALUES ('special-catalog', 'Special add-ons (all occasions)', 100, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- Deterministic UUIDs for idempotent re-runs
INSERT INTO offerable_services (
    id, category_id, name, description, city,
    price_basic, price_min, price_max, price_unit,
    is_active, is_special_catalog, display_order
) VALUES
(
    'b1000001-0000-4000-8000-000000000001',
    'special-catalog',
    'Odiya Bhara',
    'Traditional Odiya Bhara arrangements for your celebration.',
    'Bhubaneswar',
    2500, 2500, 2500, 'per unit',
    true, true, 1
),
(
    'b1000001-0000-4000-8000-000000000002',
    'special-catalog',
    'Puja Samagri',
    'Complete puja essentials and samagri kit.',
    'Bhubaneswar',
    1200, 1200, 1200, 'per kit',
    true, true, 2
),
(
    'b1000001-0000-4000-8000-000000000003',
    'special-catalog',
    'Party Poppers',
    'Celebration party poppers bundle.',
    'Bhubaneswar',
    800, 800, 800, 'per pack',
    true, true, 3
),
(
    'b1000001-0000-4000-8000-000000000004',
    'special-catalog',
    'Subsidized Beverages',
    'Curated beverage packages at subsidized rates.',
    'Bhubaneswar',
    3500, 3500, 3500, 'per package',
    true, true, 4
),
(
    'b1000001-0000-4000-8000-000000000005',
    'special-catalog',
    'Fire crackers',
    'Licensed firecracker sets (subject to local regulations).',
    'Bhubaneswar',
    5000, 5000, 5000, 'per set',
    true, true, 5
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_basic = EXCLUDED.price_basic,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    is_special_catalog = true,
    is_active = true;

DELETE FROM service_occasions
WHERE service_id IN (SELECT id FROM offerable_services WHERE is_special_catalog = true);

INSERT INTO service_occasions (occasion_id, service_id)
SELECT o.id, s.id
FROM occasions o
CROSS JOIN offerable_services s
WHERE s.is_special_catalog = true AND o.is_active IS NOT FALSE;

INSERT INTO testimonials (id, display_name, testimonial_text, video_url, voice_recording_url, image_url, display_order, is_active)
VALUES
(
    'c2000001-0000-4000-8000-000000000001',
    'Priya & Rahul',
    'Ekatraa made our wedding planning stress-free. Every vendor was verified and the budget tool was a lifesaver.',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    NULL,
    NULL,
    1,
    true
),
(
    'c2000001-0000-4000-8000-000000000002',
    'The Mishra Family',
    'Professional, warm, and truly Odia at heart. Highly recommend for thread ceremonies and gatherings.',
    NULL,
    NULL,
    NULL,
    2,
    true
)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    testimonial_text = EXCLUDED.testimonial_text,
    video_url = EXCLUDED.video_url,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

COMMIT;
