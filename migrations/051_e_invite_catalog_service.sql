-- Catalog row for cart/checkout: AI E-Invite (digital). Real price comes from cart_items.unit_price (per user_e_invites.price_inr).

BEGIN;

INSERT INTO categories (id, name, display_order, is_active)
VALUES ('special-catalog', 'Special add-ons (all occasions)', 100, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

INSERT INTO offerable_services (
    id,
    category_id,
    name,
    description,
    city,
    price_basic,
    price_min,
    price_max,
    price_unit,
    is_active,
    is_special_catalog,
    display_order
) VALUES (
    'e1000001-0000-4000-8000-000000000001',
    'special-catalog',
    'AI E-Invite',
    'Digital invitation created in AI E-Invite Studio (static image or animated). License fee is set per design when you add it to cart.',
    'India',
    1,
    1,
    1,
    'per invite',
    true,
    true,
    99
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_unit = EXCLUDED.price_unit,
    is_special_catalog = true,
    is_active = true;

DELETE FROM service_occasions
WHERE service_id = 'e1000001-0000-4000-8000-000000000001';

INSERT INTO service_occasions (occasion_id, service_id)
SELECT o.id, 'e1000001-0000-4000-8000-000000000001'::uuid
FROM occasions o
WHERE o.is_active IS NOT FALSE;

COMMIT;
