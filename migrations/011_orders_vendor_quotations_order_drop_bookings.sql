-- 011_orders_vendor_quotations_order_drop_bookings.sql
-- Replace bookings with orders: add vendor_id to orders for allocation,
-- add order_id to quotations (quotations submitted for allocated orders),
-- remove booking_id from quotations and drop bookings table.

BEGIN;

-- 1) Allow orders to be allocated to vendors (like bookings were)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);

-- 2) Link quotations to orders instead of bookings
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);

-- 3) Remove booking reference from quotations (drop FK first if exists, then column)
ALTER TABLE quotations
DROP COLUMN IF EXISTS booking_id;

-- 4) Drop bookings table
DROP TABLE IF EXISTS bookings CASCADE;

COMMIT;
