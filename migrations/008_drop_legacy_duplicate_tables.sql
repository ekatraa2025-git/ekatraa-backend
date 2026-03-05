-- 008_drop_legacy_duplicate_tables.sql
-- Drops legacy/duplicate tables that are superseded by the new catalog model.
--
-- NEW MODEL (keep):
--   occasions, categories, occasion_categories, offerable_services, service_occasions,
--   carts, cart_items, orders, order_items, order_status_history, vendors, services, etc.
--
-- LEGACY TABLES DROPPED BY THIS SCRIPT:
--   event_types          -> superseded by occasions
--   vendor_categories    -> superseded by categories (catalog categories)
--   service_subcategories -> was tied to vendor_categories; flow now uses categories + offerable_services
--   service_stocks       -> superseded by offerable_services (with tier pricing)
--   app_service_catalog -> superseded by offerable_services + service_occasions
--
-- PREREQUISITES (do before running this script):
--   1. Vendors use category_id -> categories (catalog). Admin vendor form uses Catalog Categories.
--   2. Public services come from offerable_services (GET /api/public/services with occasion_id/category_id).
--   3. Migrate GET /api/categories to read from 'categories' instead of 'vendor_categories'.
--   4. Remove or migrate any admin UI that still uses Event Types, Vendor Categories, Subcategories, Stocks, or App Service Catalog.
--   5. Backfill/migration from legacy tables to new tables is done (occasions, categories, offerable_services).
--
-- Run in Supabase SQL Editor. Order respects FKs (children before parents where applicable).
-- Uses CASCADE to drop dependent objects (e.g. views, FKs from other schemas). Use with care.

BEGIN;

-- 1) service_stocks (often references service_subcategories)
DROP TABLE IF EXISTS service_stocks CASCADE;

-- 2) service_subcategories (references vendor_categories)
DROP TABLE IF EXISTS service_subcategories CASCADE;

-- 3) vendor_categories (referenced by old subcategories; vendors now use categories)
DROP TABLE IF EXISTS vendor_categories CASCADE;

-- 4) app_service_catalog (legacy catalog; may reference event_types)
DROP TABLE IF EXISTS app_service_catalog CASCADE;

-- 5) event_types (superseded by occasions)
DROP TABLE IF EXISTS event_types CASCADE;

COMMIT;

-- After running, re-run MIGRATION_CHECKS.sql and remove or adjust the "Legacy tables still present" check (step 10),
-- since these five tables will no longer exist.
