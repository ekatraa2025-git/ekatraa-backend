-- Who applied (Groom / Bride / Host / Other) — separate from occasion name (Wedding, etc.)

ALTER TABLE carts ADD COLUMN IF NOT EXISTS event_role TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS event_role TEXT;
