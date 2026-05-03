-- User-generated e-invites (stored media + payment) and animated-invite OpenRouter model.

BEGIN;

-- Align with admin AI settings (safe if already applied elsewhere)
ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS ai_primary_provider TEXT NOT NULL DEFAULT 'openrouter',
    ADD COLUMN IF NOT EXISTS ai_primary_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_openrouter_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_openrouter_image_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_openrouter_invite_animated_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_claude_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_gemini_model TEXT;

UPDATE platform_settings
SET
    ai_primary_provider = COALESCE(NULLIF(TRIM(ai_primary_provider), ''), 'openrouter'),
    ai_openrouter_model = COALESCE(NULLIF(TRIM(ai_openrouter_model), ''), 'nvidia/nemotron-3-nano-omni:free'),
    ai_openrouter_image_model = COALESCE(NULLIF(TRIM(ai_openrouter_image_model), ''), 'sourceful/riverflow-v2-fast'),
    ai_openrouter_invite_animated_model = COALESCE(
        NULLIF(TRIM(ai_openrouter_invite_animated_model), ''),
        'sourceful/riverflow-v2-pro'
    ),
    ai_claude_model = COALESCE(NULLIF(TRIM(ai_claude_model), ''), 'claude-sonnet-4-6'),
    ai_gemini_model = COALESCE(NULLIF(TRIM(ai_gemini_model), ''), 'gemini-3.1-flash-lite-preview'),
    ai_primary_model = COALESCE(
        NULLIF(TRIM(ai_primary_model), ''),
        NULLIF(TRIM(ai_openrouter_model), ''),
        'nvidia/nemotron-3-nano-omni:free'
    ),
    updated_at = NOW()
WHERE id = 'default';

CREATE TABLE IF NOT EXISTS user_e_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    media_kind TEXT NOT NULL CHECK (media_kind IN ('static', 'animated')),
    status TEXT NOT NULL DEFAULT 'awaiting_payment'
        CHECK (status IN ('awaiting_payment', 'paid', 'cancelled')),
    price_inr INT NOT NULL CHECK (price_inr > 0),
    storage_path TEXT NOT NULL,
    form_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    prompt_used TEXT,
    model_used TEXT,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    paid_at TIMESTAMPTZ,
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_e_invites_user_created ON user_e_invites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_e_invites_status ON user_e_invites (status);

NOTIFY pgrst, 'reload schema';

COMMIT;
