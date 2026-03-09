BEGIN;

ALTER TABLE carts ALTER COLUMN planned_budget TYPE TEXT USING planned_budget::TEXT;
ALTER TABLE orders ALTER COLUMN planned_budget TYPE TEXT USING planned_budget::TEXT;

COMMIT;
