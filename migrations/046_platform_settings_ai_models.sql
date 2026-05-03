-- Admin-configurable AI provider/model routing + OpenRouter image model for e-invites.

BEGIN;

ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS ai_primary_provider TEXT NOT NULL DEFAULT 'openrouter',
    ADD COLUMN IF NOT EXISTS ai_primary_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_openrouter_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_openrouter_image_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_claude_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_gemini_model TEXT;

UPDATE platform_settings
SET
    ai_primary_provider = COALESCE(NULLIF(TRIM(ai_primary_provider), ''), 'openrouter'),
    ai_openrouter_model = COALESCE(NULLIF(TRIM(ai_openrouter_model), ''), 'nvidia/nemotron-3-nano-omni:free'),
    ai_openrouter_image_model = COALESCE(NULLIF(TRIM(ai_openrouter_image_model), ''), 'sourceful/riverflow-v2-fast'),
    ai_claude_model = COALESCE(NULLIF(TRIM(ai_claude_model), ''), 'claude-sonnet-4-6'),
    ai_gemini_model = COALESCE(NULLIF(TRIM(ai_gemini_model), ''), 'gemini-3.1-flash-lite-preview'),
    ai_primary_model = COALESCE(
        NULLIF(TRIM(ai_primary_model), ''),
        NULLIF(TRIM(ai_openrouter_model), ''),
        'nvidia/nemotron-3-nano-omni:free'
    ),
    updated_at = NOW()
WHERE id = 'default';

NOTIFY pgrst, 'reload schema';

COMMIT;
