-- Customer budget / recommendation snapshots for admin review; optional precise cart budget (INR).

BEGIN;

ALTER TABLE carts ADD COLUMN IF NOT EXISTS planned_budget_inr BIGINT;

CREATE TABLE IF NOT EXISTS budget_recommendation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cart_id UUID REFERENCES carts(id) ON DELETE SET NULL,
    user_id UUID,
    occasion_id TEXT NOT NULL,
    contact_name TEXT,
    contact_mobile TEXT,
    contact_email TEXT,
    form_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    budget_inr NUMERIC NOT NULL,
    category_percentages JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommendation_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_narrative JSONB,
    ai_meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_budget_rec_snapshots_created ON budget_recommendation_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_rec_snapshots_mobile ON budget_recommendation_snapshots(contact_mobile);
CREATE INDEX IF NOT EXISTS idx_budget_rec_snapshots_cart ON budget_recommendation_snapshots(cart_id);

COMMIT;
