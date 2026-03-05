-- Add icon_url column to categories table for category icons/images
-- offerable_services already has image_url column so no change needed there

ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Add icon_url to occasions table as well (currently only has emoji 'icon')
ALTER TABLE occasions ADD COLUMN IF NOT EXISTS icon_url TEXT;
