-- Vendor profile/logo image and service images
-- Run in Supabase SQL Editor. Safe to run multiple times.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE vendors ADD COLUMN logo_url TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE services ADD COLUMN image_url TEXT;
    END IF;
END $$;
