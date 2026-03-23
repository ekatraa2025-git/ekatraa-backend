-- 021_occasion_budget_allocations.sql
-- Occasion-specific budget percentage allocations per category for recommendation algorithm.
-- Admin assigns percentage per category per occasion; total should sum to 100.

BEGIN;

CREATE TABLE IF NOT EXISTS occasion_budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occasion_id TEXT NOT NULL REFERENCES occasions(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    percentage DECIMAL(5, 2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(occasion_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_occasion_budget_allocations_occasion ON occasion_budget_allocations(occasion_id);

COMMIT;
