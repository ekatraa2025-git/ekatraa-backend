-- Ensure image_url holds Supabase storage paths (e.g. testimonials/xxx.png), not UUIDs.
-- If the column was created as uuid by mistake, inserts fail with:
-- invalid input syntax for type uuid: "…png"

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
  INTO col_type
  FROM pg_attribute a
  JOIN pg_class t ON a.attrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'testimonials'
    AND a.attname = 'image_url'
    AND NOT a.attisdropped;

  IF col_type = 'uuid' THEN
    ALTER TABLE public.testimonials
      ALTER COLUMN image_url TYPE text USING image_url::text;
  END IF;
END $$;
