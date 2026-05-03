BEGIN;

-- Admin AI settings (may already exist in some envs)
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS ai_primary_provider TEXT NOT NULL DEFAULT 'openrouter';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS ai_primary_model TEXT DEFAULT 'nvidia/nemotron-3-nano-omni:free';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS ai_openrouter_model TEXT DEFAULT 'nvidia/nemotron-3-nano-omni:free';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS ai_openrouter_image_model TEXT DEFAULT 'sourceful/riverflow-v2-fast';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS ai_openrouter_invite_animated_model TEXT DEFAULT 'sourceful/riverflow-v2-pro';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS ai_claude_model TEXT DEFAULT 'claude-sonnet-4-6';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS ai_gemini_model TEXT DEFAULT 'gemini-3.1-flash-lite-preview';

CREATE TABLE IF NOT EXISTS public.user_e_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    media_kind TEXT NOT NULL CHECK (media_kind IN ('static', 'animated')),
    storage_path TEXT NOT NULL,
    price_inr INT NOT NULL CHECK (price_inr > 0),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed')),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    prompt TEXT,
    form_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_e_invites_user_created
    ON public.user_e_invites (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_e_invites_payment
    ON public.user_e_invites (payment_status, created_at DESC);

ALTER TABLE public.user_e_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_e_invites_select_own" ON public.user_e_invites;
CREATE POLICY "user_e_invites_select_own"
  ON public.user_e_invites FOR SELECT
  USING (auth.uid() = user_id);

COMMIT;
