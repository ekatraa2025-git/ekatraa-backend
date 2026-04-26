-- Add optional occasion fields on vendor services.
-- Needed by vendor app bulk add/save to persist selected occasion context.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS occasion_id TEXT,
  ADD COLUMN IF NOT EXISTS occasion_name TEXT;

CREATE INDEX IF NOT EXISTS idx_services_occasion_id
  ON public.services (occasion_id)
  WHERE occasion_id IS NOT NULL;
