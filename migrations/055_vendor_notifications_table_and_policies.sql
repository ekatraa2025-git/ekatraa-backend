-- Vendor in-app notifications table + RLS + realtime publication.
-- Keeps notifications readable by vendor owners and active vendor team members.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_notifications_vendor_created
    ON public.vendor_notifications (vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_notifications_unread
    ON public.vendor_notifications (vendor_id, read)
    WHERE read = false;

ALTER TABLE public.vendor_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_notifications_select" ON public.vendor_notifications;
CREATE POLICY "vendor_notifications_select"
    ON public.vendor_notifications FOR SELECT
    USING (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1
            FROM public.vendor_team_members vtm
            WHERE vtm.vendor_id = vendor_notifications.vendor_id
              AND vtm.member_user_id = auth.uid()
              AND vtm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "vendor_notifications_update" ON public.vendor_notifications;
CREATE POLICY "vendor_notifications_update"
    ON public.vendor_notifications FOR UPDATE
    USING (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1
            FROM public.vendor_team_members vtm
            WHERE vtm.vendor_id = vendor_notifications.vendor_id
              AND vtm.member_user_id = auth.uid()
              AND vtm.status = 'active'
        )
    )
    WITH CHECK (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1
            FROM public.vendor_team_members vtm
            WHERE vtm.vendor_id = vendor_notifications.vendor_id
              AND vtm.member_user_id = auth.uid()
              AND vtm.status = 'active'
        )
    );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'vendor_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_notifications;
  END IF;
END $$;

COMMIT;
