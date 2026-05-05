-- Optional WebM (or other video) paths in Supabase Storage for richer catalog media.
-- Safe to run multiple times.

ALTER TABLE occasions
ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE offerable_services
ADD COLUMN IF NOT EXISTS video_url TEXT;

NOTIFY pgrst, 'reload schema';
