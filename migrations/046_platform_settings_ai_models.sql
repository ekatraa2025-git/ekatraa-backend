-- Admin-configurable AI provider/model routing.

BEGIN;

ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS ai_primary_provider TEXT NOT NULL DEFAULT 'openrouter',
    ADD COLUMN IF NOT EXISTS ai_primary_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_openrouter_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_claude_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_gemini_model TEXT;

UPDATE platform_settings
SET
    ai_primary_provider = COALESCE(NULLIF(ai_primary_provider, ''), 'openrouter'),
    ai_openrouter_model = COALESCE(NULLIF(ai_openrouter_model, ''), 'nvidia/nemotron-3-nano-omni:free'),
    ai_claude_model = COALESCE(NULLIF(ai_claude_model, ''), 'claude-sonnet-4-6'),
    ai_gemini_model = COALESCE(NULLIF(ai_gemini_model, ''), 'gemini-3.1-flash-lite-preview'),
    ai_primary_model = COALESCE(
        NULLIF(ai_primary_model, ''),
        NULLIF(ai_openrouter_model, ''),
        'nvidia/nemotron-3-nano-omni:free'
    ),
    updated_at = NOW()
WHERE id = 'default';

NOTIFY pgrst, 'reload schema';

COMMIT;
