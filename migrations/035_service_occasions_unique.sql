-- Ensure one row per (occasion, service) for upserts from admin API.
CREATE UNIQUE INDEX IF NOT EXISTS service_occasions_occasion_service_unique
  ON public.service_occasions (occasion_id, service_id);
