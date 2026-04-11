BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors (id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  platform TEXT,
  app_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_push_tokens_vendor_active
  ON public.vendor_push_tokens (vendor_id, is_active, updated_at DESC);

ALTER TABLE public.vendor_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_push_tokens_select_own" ON public.vendor_push_tokens;
CREATE POLICY "vendor_push_tokens_select_own"
  ON public.vendor_push_tokens FOR SELECT
  USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "vendor_push_tokens_insert_own" ON public.vendor_push_tokens;
CREATE POLICY "vendor_push_tokens_insert_own"
  ON public.vendor_push_tokens FOR INSERT
  WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "vendor_push_tokens_update_own" ON public.vendor_push_tokens;
CREATE POLICY "vendor_push_tokens_update_own"
  ON public.vendor_push_tokens FOR UPDATE
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);

COMMIT;
