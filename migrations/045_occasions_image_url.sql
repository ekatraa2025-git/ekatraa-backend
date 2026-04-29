-- Add image_url to occasions for app/admin image-based occasion cards
-- Safe to run multiple times.

ALTER TABLE occasions
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Optional backfill from legacy icon_url if it already stores image paths/URLs.
UPDATE occasions
SET image_url = icon_url
WHERE image_url IS NULL
  AND icon_url IS NOT NULL
  AND btrim(icon_url) <> '';

-- Refresh PostgREST schema cache in Supabase (avoids "column not found in schema cache").
NOTIFY pgrst, 'reload schema';
