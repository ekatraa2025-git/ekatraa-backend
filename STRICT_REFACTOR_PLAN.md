# STRICT REFACTOR PLAN — Service E‑commerce Flow

**Repositories:** ekatraa_backend, ekatraa (customer app)  
**Do NOT modify:** ekatraa_vendor  
**Mission:** Refactor to flow: **Occasion → Category → Service → Cart → Checkout → Order**. No subcategory in active business flow.

**Source files (reference):** `/Users/ZantrikTechnologies/Downloads/Flow.xlsx`, `/Users/ZantrikTechnologies/Downloads/Excel.xlsx` — category/occasion normalization to be aligned with these; XLSX content not parsed in-repo (manual or tool-based extraction).

---

## 1) Current schema inventory

Database: **Supabase (PostgreSQL)**. No in-repo SQL migration files; schema inferred from code and from `ekatraa/database/schema.sql` where applicable.

### Tables (backend usage)

| Table | Purpose | Key columns (from code) |
|-------|---------|--------------------------|
| **event_types** | Occasion/event lookup | id (PK), name, icon, display_order, is_active |
| **vendor_categories** | Categories (legacy name) | id, name |
| **service_subcategories** | Subcategories (to deprecate from flow) | id, name, category_id → vendor_categories |
| **service_stocks** | Service items / stocks (to deprecate from flow) | id, name, subcategory_id, price_classic_value, price_signature, price_prestige, price_royal, price_imperial |
| **app_service_catalog** | App-facing service catalog | event_types (array), is_active, display_order, + other fields |
| **banners** | Promo/success story banners | id, title, image_url, banner_type, display_order, is_active, start_date, end_date |
| **vendors** | Vendor entity | id, category, etc. (used by admin and quotations) |
| **venues** | Venue listings | id, name, city, event_types (array), etc. |
| **bookings** | Legacy bookings | vendor_id, etc. |
| **user_bookings** | Customer-facing bookings | user_id, enquiry_id, vendor_id, service_id, venue_id, event_type, event_date, booking_status, payment_status |
| **enquiries** | Enquiry/quote requests | user_id, vendor_id, event_type, event_date, contact_*, status |
| **service_enquiries** | Service-specific enquiries | user_id, vendor_id, service_id, event_type |
| **quotations** | Admin quotations | linked to vendors, bookings, services |
| **vendor_notifications** | Vendor notifications | — |
| **cities** | Location dropdown | id, name, state, is_active |
| **user_profiles** | Extended user info | id → auth.users, full_name, phone, email |
| **translations** | i18n | — |

**Storage:** Bucket `ekatraa2025` (signed URLs in admin storage and quotations); no table named `ekatraa2025`.

**Note:** `ekatraa/database/schema.sql` defines cities, event_types, venues, user_profiles, enquiries, service_enquiries, user_bookings, banners and RLS; it references `vendors(id)` and `services(id)` which are assumed to exist in Supabase (vendor/admin schema).

---

## 2) Current API inventory

Next.js App Router: `src/app/api/`.

### Public (no auth required for read)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/categories` | vendor_categories list |
| GET | `/api/subcategories` | service_subcategories, query `category_id` |
| GET | `/api/stocks` | service_stocks, query `subcategory_id` |
| GET | `/api/translations` | — |
| GET | `/api/public/banners` | — |
| GET | `/api/public/event-types` | event_types |
| GET | `/api/public/services` | app_service_catalog (filter by eventType/event_type), fallback vendor_categories |
| GET | `/api/public/venues/featured` | query city, limit |
| POST | `/api/auth/login` | — |
| POST | `/api/kyc/aadhaar/generate-otp` | — |
| POST | `/api/kyc/aadhaar/verify-otp` | — |

### Admin (`/api/admin/`)

| Method | Path | Notes |
|--------|------|--------|
| GET/POST | `/api/admin/storage/signed-url` | query path |
| GET/POST/GET/PATCH/DELETE | `/api/admin/app-service-catalog`, `.../[id]` | CRUD app_service_catalog |
| GET/POST/GET/PATCH/DELETE | `/api/admin/event-types`, `.../[id]` | CRUD event_types |
| GET/POST/GET/PATCH/DELETE | `/api/admin/banners`, `.../[id]` | CRUD banners |
| GET/POST/GET/PATCH/DELETE | `/api/admin/vendors`, `.../[id]` | CRUD vendors |
| GET/POST/GET/PATCH/DELETE | `/api/admin/stocks`, `.../[id]` | CRUD service_stocks (subcategory_id) |
| GET/POST/GET/PATCH/DELETE | `/api/admin/subcategories`, `.../[id]` | CRUD service_subcategories |
| GET/POST/GET/PATCH/DELETE | `/api/admin/categories`, `.../[id]` | CRUD vendor_categories |
| GET/POST/GET/PATCH/DELETE | `/api/admin/services`, `.../[id]` | CRUD services (vendor services) |
| GET/GET/PATCH | `/api/admin/quotations`, `.../[id]` | Quotations |
| GET/POST/GET/PATCH/DELETE | `/api/admin/bookings`, `.../[id]` | Bookings |
| GET/POST/DELETE/PUT | `/api/admin/translations`, ... | Translations |
| POST/PUT | `/api/admin/notifications` | — |
| GET | `/api/admin/payments` | — |
| GET | `/api/admin/stats` | — |

**To deprecate/replace in active flow:** `/api/subcategories`, `/api/stocks` (and admin equivalents for flow; keep as adapters during transition).

---

## 3) Files depending on subcategories / stocks / event types

### Backend (ekatraa_backend)

**Subcategories**

- `src/app/api/subcategories/route.ts` — GET service_subcategories
- `src/app/api/admin/subcategories/route.ts` — GET/POST service_subcategories
- `src/app/api/admin/subcategories/[id]/route.ts` — GET/PATCH/DELETE
- `src/app/admin/vendors/[id]/page.tsx` — fetch subcategories, form service_subcategory
- `src/app/admin/vendors/new/page.tsx` — same

**Stocks**

- `src/app/api/stocks/route.ts` — GET service_stocks
- `src/app/api/admin/stocks/route.ts` — GET/POST service_stocks
- `src/app/api/admin/stocks/[id]/route.ts` — GET/PATCH/DELETE
- `src/app/admin/vendors/[id]/page.tsx` — fetch stocks, form service_stock_id / service_stock_name
- `src/app/admin/vendors/new/page.tsx` — same
- `src/app/admin/stocks/[id]/page.tsx`, `src/app/admin/stocks/new/page.tsx` — admin stock UI

**Event types**

- `src/app/api/public/event-types/route.ts` — GET event_types
- `src/app/api/public/services/route.ts` — filter by eventType/event_type
- `src/app/api/admin/event-types/route.ts`, `[id]/route.ts` — CRUD event_types
- `src/app/admin/app-service-catalog/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx` — event_types in form/table

### Customer app (ekatraa)

- **event_type:** `src/screens/home/Home.js` (event_types on service item), `VendorDetail.js` (enquiry event_type), `BookingModal.js` (eventType), `src/services/supabase.js` (getEventTypes, getAppServicesByEventType), `MyEnquiries.js` (display event_type), `database/schema.sql`.
- **No direct subcategory/stock references** in app code (only backend and admin).

---

## 4) Target schema + endpoint contract

### Target domain model (canonical)

- **occasions** — normalized occasion keys (replaces/maps from event_types).
- **categories** — normalized category keys (replaces vendor_categories for flow; alias from current names).
- **occasion_categories** — many-to-many (occasion_id, category_id).
- **services** — sellable services (category_id, occasions/pricing, tags e.g. new, most_booked).
- **carts** — one per user/session.
- **cart_items** — cart_id, service_id, quantity, options.
- **orders** — from checkout (user, event context, totals).
- **order_items** — order_id, service_id, quantity, price snapshot.
- **order_status_history** — order_id, status, at.
- Optional **pricing** table for tier normalization if needed.

### Canonical occasions (normalized keys)

- wedding  
- janeyu_thread  
- Others (group): birthday_anniversary, any_kind_of_puja, social_gathering, corporate, funeral_antyesti  

Names to be normalized from Flow.xlsx / Excel.xlsx; alias map for variants (e.g. décor/decor, DJ and Sound).

### Backend API contract (to implement before UI changes)

**Public**

- GET `/api/public/occasions`
- GET `/api/public/categories?occasion_id=`
- GET `/api/public/services?occasion_id=&category_id=&city=&search=`
- POST `/api/public/cart`
- GET `/api/public/cart/:id`
- POST `/api/public/cart/items`
- PATCH `/api/public/cart/items/:id`
- DELETE `/api/public/cart/items/:id`
- POST `/api/public/checkout`
- GET `/api/public/orders`
- GET `/api/public/orders/:id`

**Admin**

- Occasions CRUD  
- Categories CRUD  
- Occasion–category mapping CRUD  
- Services CRUD (category, occasions, pricing, tags: new, most_booked)  
- Orders: list, detail, status transitions  

**Legacy**

- `/api/subcategories`, `/api/stocks` → deprecated adapters or replaced; subcategory not in active model.

---

## 5) Stepwise migration and rollback strategy

### Gate 0 (Audit) — DONE

- Produce this document.
- No code changes.

### Gate 1 (DB-first)

- Add SQL migrations for: occasions, categories, occasion_categories, services (new model), carts, cart_items, orders, order_items, order_status_history.
- Backfill from event_types → occasions, vendor_categories → categories, app_service_catalog / service_stocks → services (with mapping).
- Add indexes, constraints, RLS.
- **Keep** event_types, vendor_categories, service_subcategories, service_stocks (do not drop).
- Add `MIGRATION_CHECKS.sql` for validation.
- Add `MIGRATION.md` with exact run order.

**Rollback:** Migrations must be additive only; no DROP in this phase. Rollback = stop using new tables; revert app to old endpoints.

### Gate 2 (Backend contracts)

- Implement new public + admin APIs on new model.
- Add compatibility adapters for old endpoints (e.g. /api/subcategories, /api/stocks) that read from new model or legacy tables and mark deprecated in comments/docs.
- Add backend tests for cart/order lifecycle.

**Rollback:** Feature-flag or route switch back to old handlers; DB unchanged.

### Gate 3 (Customer app integration)

- Update API client and screens to new flow (occasion → category → service → cart → checkout → order).
- Replace booking/enquiry-first flow with cart/order-first; event context (name, mobile, email, event date, guests, location/venue preference, budget) attached to cart/order.
- Remove subcategory/stocks dependence from app code; keep old screens as non-primary fallback if needed.

**Rollback:** Point app back to old APIs; backend keeps both.

### Gate 4 (Cleanup)

- Remove dead code paths (backend + app).
- Safe deprecation only; no destructive table drops in this phase unless explicitly verified and approved.
- Final docs + QA checklist.

---

## 6) Status table (traceability)

| Task | Gate | Status | Files changed | Verification |
|------|------|--------|----------------|--------------|
| STRICT_REFACTOR_PLAN.md | 0 | Done | ekatraa_backend/STRICT_REFACTOR_PLAN.md | Document complete |
| SQL migrations (new tables) | 1 | Done | migrations/001–003 | Additive only |
| Backfill scripts | 1 | Done | migrations/004–005 | Occasions, categories, offerable_services |
| Indexes + RLS | 1 | Done | migrations/001–003, 006_rls.sql | RLS in 006 |
| MIGRATION_CHECKS.sql | 1 | Done | ekatraa_backend/MIGRATION_CHECKS.sql | Validation queries |
| MIGRATION.md | 1 | Done | ekatraa_backend/MIGRATION.md | Run order documented |
| New public APIs | 2 | Done | src/app/api/public/* | Occasions, categories, services, cart, checkout, orders |
| New admin APIs | 2 | Done | src/app/api/admin/occasions, catalog-categories, occasion-categories, offerable-services, orders | CRUD + order status |
| Deprecated adapters | 2 | Done | src/app/api/subcategories, stocks | Comments added |
| Cart/order tests | 2 | Done | tests/cart-order-lifecycle.mjs | npm run test (requires server + migrations) |
| Customer app integration | 3 | Done | ekatraa: api.js, Home.js, Cart, Checkout, OrderDetail, MyOrders, Menu, navigation | New flow when API URL set |
| Cleanup + QA | 4 | Done | STRICT_REFACTOR_PLAN.md, QA_CHECKLIST.md | No destructive drops |

---

## 7) Blockers and mitigations

- **Excel source (Flow.xlsx, Excel.xlsx):** Not read in-repo. Mitigation: Normalize category/occasion names manually or via script; maintain alias map in config/constants; update when source is available.
- **Vendor app (ekatraa_vendor):** Out of scope; no changes. Order/cart model should remain compatible for a later vendor phase.

---

## 8) Deliverables (end of refactor)

- **Migrations:** See `MIGRATION.md` (001–006 run order; MIGRATION_CHECKS.sql for validation).
- **New endpoints:** See section 4 (public: occasions, categories, services, cart, checkout, orders; admin: occasions, catalog-categories, occasion-categories, offerable-services, orders).
- **Deprecated (marked in code):** GET /api/subcategories, GET /api/stocks.
- **Changed app screens/services:**
  - **ekatraa:** `src/services/api.js` (new flow APIs); `src/screens/home/Home.js` (occasions, categories, add-to-cart, cart icon); `src/screens/cart/Cart.js` (new); `src/screens/orders/Checkout.js`, `OrderDetail.js`, `MyOrders.js` (new); `src/screens/menu/Menu.js` (My Orders); `src/navigation/index.js` (Cart, Checkout, OrderDetail, MyOrders).
- **Manual QA checklist:** `QA_CHECKLIST.md`.
- **Follow-ups:** Vendor app phase later; optional table drops after verification; category filter chips on Home (optional).

---

*Last updated: Gate 4 complete. Admin menu updated; customer app uses new flow when EXPO_PUBLIC_API_URL is set. QA_CHECKLIST.md added.*
