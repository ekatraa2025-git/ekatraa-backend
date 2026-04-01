-- Vendors: fix typo column is_activee -> is_active, add gallery, notification tables

BEGIN;

-- 1) Rename mistyped column if it exists (PostgREST "schema cache" errors referencing is_activee)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'is_activee'
  ) THEN
    ALTER TABLE public.vendors RENAME COLUMN is_activee TO is_active;
  END IF;
END $$;

-- 2) Ensure is_active exists and stays aligned with status
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

UPDATE public.vendors SET is_active = (COALESCE(status, '') = 'active') WHERE true;

-- 3) Gallery images (storage object keys or public URLs, same convention as logo_url)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] DEFAULT '{}';

-- 4) Admin inbox (dashboard can poll / extend later)
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON public.admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON public.admin_notifications (read) WHERE read = false;

-- 5) Consumer app users
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notifications_select_own" ON public.user_notifications;
CREATE POLICY "user_notifications_select_own"
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_notifications_insert_service" ON public.user_notifications;
-- Inserts are performed by backend (service role); optional policy for authenticated inserts if needed later

COMMIT;
