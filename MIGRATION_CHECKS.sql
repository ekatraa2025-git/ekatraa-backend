-- MIGRATION_CHECKS.sql
-- Run after migrations to validate. All checks should return expected counts or empty error rows.

-- 1) Occasions: expect rows (canonical + from event_types)
SELECT 'occasions' AS tbl, COUNT(*) AS cnt FROM occasions;
-- Expect cnt >= 1 (at least 'others' or backfilled set).

-- 2) Categories: expect rows
SELECT 'categories' AS tbl, COUNT(*) AS cnt FROM categories;
-- Expect cnt >= 1.

-- 3) Occasion_categories: expect at least one mapping
SELECT 'occasion_categories' AS tbl, COUNT(*) AS cnt FROM occasion_categories;
-- Expect cnt >= 1 if occasions and categories both have rows.

-- 4) Offerable_services: may be 0 if app_service_catalog empty
SELECT 'offerable_services' AS tbl, COUNT(*) AS cnt FROM offerable_services;

-- 5) Service_occasions: optional
SELECT 'service_occasions' AS tbl, COUNT(*) AS cnt FROM service_occasions;

-- 6) FK integrity: cart_items reference valid cart and service
SELECT 'cart_items_orphans' AS check_name, COUNT(*) AS cnt
FROM cart_items ci
LEFT JOIN carts c ON c.id = ci.cart_id
LEFT JOIN offerable_services s ON s.id = ci.service_id
WHERE c.id IS NULL OR s.id IS NULL;
-- Expect 0.

-- 7) Order_items reference valid order and service
SELECT 'order_items_orphans' AS check_name, COUNT(*) AS cnt
FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id
LEFT JOIN offerable_services s ON s.id = oi.service_id
WHERE o.id IS NULL OR s.id IS NULL;
-- Expect 0.

-- 8) Order_status_history references valid order
SELECT 'order_status_history_orphans' AS check_name, COUNT(*) AS cnt
FROM order_status_history osh
LEFT JOIN orders o ON o.id = osh.order_id
WHERE o.id IS NULL;
-- Expect 0.

-- 9) RLS enabled on new tables
SELECT relname AS table_name,
       relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN (
    'occasions', 'categories', 'occasion_categories',
    'offerable_services', 'service_occasions',
    'carts', 'cart_items', 'orders', 'order_items', 'order_status_history'
)
ORDER BY relname;
-- Expect rls_enabled = true for all.

-- 10) Legacy tables still present (no destructive drop)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('event_types', 'vendor_categories', 'service_subcategories', 'service_stocks', 'app_service_catalog');
-- Expect 5 rows.
