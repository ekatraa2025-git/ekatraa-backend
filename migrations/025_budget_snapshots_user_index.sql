-- Speed up listing saved recommendations by app user id.

CREATE INDEX IF NOT EXISTS idx_budget_rec_snapshots_user_id ON budget_recommendation_snapshots(user_id);
