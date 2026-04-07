-- Optional service-area coordinates for vendors (set from vendor app map pin).
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
