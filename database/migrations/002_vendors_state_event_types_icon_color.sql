-- Add state to vendors; add image_url and color to event_types
-- Run in Supabase SQL Editor. Safe to run multiple times.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'state'
    ) THEN
        ALTER TABLE vendors ADD COLUMN state VARCHAR(100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'event_types' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE event_types ADD COLUMN image_url TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'event_types' AND column_name = 'color'
    ) THEN
        ALTER TABLE event_types ADD COLUMN color VARCHAR(20);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendors_state ON vendors(state);
