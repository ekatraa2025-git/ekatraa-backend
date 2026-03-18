-- 020_order_item_allocations.sql
-- Allow multiple vendors per order: allocate individual order items to vendors in different locations.
-- An order can have different services allocated to different vendors.

BEGIN;

CREATE TABLE IF NOT EXISTS order_item_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_item_allocations_order_item ON order_item_allocations(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_allocations_vendor ON order_item_allocations(vendor_id);

COMMIT;
