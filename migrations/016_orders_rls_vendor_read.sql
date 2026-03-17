-- 016_orders_rls_vendor_read.sql
-- Allow vendors to read their allocated orders and order_items via Supabase client (anon key).
-- Required for vendor app fallback when API is unavailable.

-- Enable RLS on orders if not already (idempotent)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Vendors can SELECT orders allocated to them
DROP POLICY IF EXISTS "Vendors can read allocated orders" ON orders;
CREATE POLICY "Vendors can read allocated orders"
ON orders FOR SELECT
USING (vendor_id = auth.uid());

-- Enable RLS on order_items if not already
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policy: Vendors can SELECT order_items for orders allocated to them
DROP POLICY IF EXISTS "Vendors can read their order items" ON order_items;
CREATE POLICY "Vendors can read their order items"
ON order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND orders.vendor_id = auth.uid()
  )
);
