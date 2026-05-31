-- Vendor AI (Ekaa) conversation logging for support analytics and thread history.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'app' CHECK (channel IN ('app', 'whatsapp')),
    language TEXT CHECK (language IN ('en', 'hi', 'bn', 'or')),
    summary TEXT,
    useful_info_extracted JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    CONSTRAINT vendor_ai_conversations_vendor_thread_unique UNIQUE (vendor_id, thread_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_ai_conversations_vendor_updated
    ON public.vendor_ai_conversations (vendor_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.vendor_ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    text TEXT NOT NULL,
    detected_language TEXT,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_ai_messages_conversation_created
    ON public.vendor_ai_messages (conversation_id, created_at ASC);

ALTER TABLE public.vendor_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_ai_conversations_select" ON public.vendor_ai_conversations;
CREATE POLICY "vendor_ai_conversations_select"
    ON public.vendor_ai_conversations FOR SELECT
    USING (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1
            FROM public.vendor_team_members vtm
            WHERE vtm.vendor_id = vendor_ai_conversations.vendor_id
              AND vtm.member_user_id = auth.uid()
              AND vtm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "vendor_ai_messages_select" ON public.vendor_ai_messages;
CREATE POLICY "vendor_ai_messages_select"
    ON public.vendor_ai_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.vendor_ai_conversations c
            WHERE c.id = vendor_ai_messages.conversation_id
              AND (
                  auth.uid() = c.vendor_id
                  OR EXISTS (
                      SELECT 1
                      FROM public.vendor_team_members vtm
                      WHERE vtm.vendor_id = c.vendor_id
                        AND vtm.member_user_id = auth.uid()
                        AND vtm.status = 'active'
                  )
              )
        )
    );

COMMIT;
