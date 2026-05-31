-- Persist cart line options (e.g. user_e_invite_id) on order_items for post-checkout access.

BEGIN;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS options JSONB;

NOTIFY pgrst, 'reload schema';

COMMIT;
