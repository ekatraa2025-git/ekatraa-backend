# QA Checklist — New flow (Occasion → Category → Service → Cart → Order)

Run with **EXPO_PUBLIC_API_URL** set to your backend (e.g. `http://localhost:3000` or deployed URL).

## Backend (ekatraa_backend)

- [ ] Migrations 001–006 run in Supabase in order; `MIGRATION_CHECKS.sql` passes
- [ ] `npm run build` succeeds
- [ ] `npm run test` passes (with server running)
- [ ] Admin sidebar shows: Occasions, Catalog Categories, Occasion–Categories, Services, Orders (no Subcategories / Service Items)
- [ ] Admin: Create occasion, catalog category, service; link occasion–category; create order via API and see it in Orders list
- [ ] GET /api/public/occasions returns list
- [ ] GET /api/public/categories?occasion_id=wedding returns categories
- [ ] GET /api/public/services?occasion_id=wedding&category_id=venue returns services
- [ ] POST /api/public/cart → GET /api/public/cart/:id → POST cart/items → POST checkout → GET orders

## Customer app (ekatraa)

- [ ] Home: When API URL set, occasion chips load from /api/public/occasions (or event-types fallback)
- [ ] Home: Selecting occasion loads services (with optional category filter)
- [ ] Home: “Add to cart” on a service creates cart (if needed) and adds item
- [ ] Home: Cart icon in header opens Cart screen (with cart id)
- [ ] Cart: List items, change quantity, remove item; “Proceed to Checkout” opens Checkout
- [ ] Checkout: Fill event/contact details; “Place order” requires login; on success navigate to Order detail
- [ ] My Orders: List orders for logged-in user; tap order opens Order detail
- [ ] Menu: “My Orders” opens MyOrders screen
- [ ] Legacy: Without API URL, app still works with Supabase/mock (event types, services, vendors, enquiries)

## Regression

- [ ] My Bookings, My Enquiries, Vendor detail, Venue detail still work
- [ ] Login / profile unchanged
- [ ] No crashes when API URL is unset (Supabase/mock path)

## Known follow-ups

- Vendor app (ekatraa_vendor): not in scope; order/cart model ready for future vendor phase
- Category chips on Home: optional UI to filter services by category when occasion selected
- RLS: cart/orders use user_id; anonymous cart by session_id may need tighter policies per env
- Deprecated admin routes (/admin/subcategories, /admin/stocks) and vendor forms still reference subcategory/stock; safe to keep until vendor app is updated
