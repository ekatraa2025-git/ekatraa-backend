# Migration run order

Run these in **Supabase SQL Editor** (or your migration runner) in order. Do **not** skip steps. Legacy tables are **not** dropped.

## Prerequisites

- Supabase project with `auth.users` (and optionally existing tables: `event_types`, `vendor_categories`, `app_service_catalog`).
- If `event_types` or `vendor_categories` do not exist, migrations 004 and 005 will partially fail; run 001–003 and 006 first, then backfill occasions/categories manually or create legacy tables and re-run 004–005.

## Exact run order

| Order | File | Description |
|-------|------|-------------|
| 1 | `migrations/001_create_occasions_and_categories.sql` | Create occasions, categories, occasion_categories, set_updated_at() |
| 2 | `migrations/002_create_offerable_services.sql` | Create offerable_services, service_occasions (depends on 001) |
| 3 | `migrations/003_create_carts_and_orders.sql` | Create carts, cart_items, orders, order_items, order_status_history |
| 4 | `migrations/004_backfill_occasions_categories.sql` | Backfill occasions from event_types, categories from vendor_categories, occasion_categories (requires event_types, vendor_categories) |
| 5 | `migrations/005_backfill_offerable_services.sql` | Backfill offerable_services from app_service_catalog, service_occasions (requires app_service_catalog) |
| 6 | `migrations/006_rls.sql` | Enable RLS and policies on all new tables |

## Validation

After running all migrations, run **`MIGRATION_CHECKS.sql`** and confirm:

- Row counts for occasions, categories, offerable_services are as expected.
- Orphan checks (cart_items, order_items, order_status_history) return 0.
- RLS is enabled on all 10 new tables.
- Legacy tables (event_types, vendor_categories, service_subcategories, service_stocks, app_service_catalog) still exist.

## Rollback (no destructive drops)

This phase does **not** drop any tables. To roll back:

1. Stop using new tables in application code.
2. Optionally drop new tables in **reverse** order of creation to satisfy FKs:
   - Drop order_status_history, order_items, orders, cart_items, carts, service_occasions, offerable_services, occasion_categories, categories, occasions.
3. Drop function `set_updated_at()` if nothing else uses it.

Example (run only if you need to remove new schema):

```sql
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS service_occasions;
DROP TABLE IF EXISTS offerable_services;
DROP TABLE IF EXISTS occasion_categories;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS occasions;
DROP FUNCTION IF EXISTS set_updated_at();
```
