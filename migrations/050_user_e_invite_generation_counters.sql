BEGIN;

CREATE TABLE IF NOT EXISTS user_e_invite_generation_counters (
    user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    total_generations INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO user_e_invite_generation_counters (user_id, total_generations, updated_at)
SELECT
    user_id,
    COUNT(*)::INT AS total_generations,
    NOW()
FROM user_e_invites
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE
SET
    total_generations = GREATEST(
        user_e_invite_generation_counters.total_generations,
        EXCLUDED.total_generations
    ),
    updated_at = NOW();

COMMIT;
