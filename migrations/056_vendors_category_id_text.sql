-- Align vendors.category_id with categories.id (TEXT slugs like venue-menu, not UUID).
-- Legacy rows stored orphan UUIDs from vendor_categories; backfill from vendors.category text.

BEGIN;

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS category_id_text TEXT;

-- Exact name match (case/space insensitive)
UPDATE public.vendors v
SET category_id_text = c.id
FROM public.categories c
WHERE v.category_id_text IS NULL
  AND v.category IS NOT NULL
  AND trim(v.category) <> ''
  AND lower(trim(regexp_replace(v.category, '\s+', ' ', 'g'))) =
      lower(trim(regexp_replace(c.name, '\s+', ' ', 'g')));

-- Legacy free-text contains catalog name (e.g. "Supplier- Puja Samagri" -> puja-samagri)
UPDATE public.vendors v
SET category_id_text = c.id
FROM public.categories c
WHERE v.category_id_text IS NULL
  AND v.category IS NOT NULL
  AND trim(v.category) <> ''
  AND length(trim(c.name)) >= 4
  AND (
    position(lower(trim(c.name)) in lower(trim(v.category))) > 0
    OR position(lower(trim(v.category)) in lower(trim(c.name))) > 0
  );

-- Drop UUID column and replace with catalog slug FK
ALTER TABLE public.vendors DROP COLUMN IF EXISTS category_id;
ALTER TABLE public.vendors RENAME COLUMN category_id_text TO category_id;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_category_id ON public.vendors (category_id);

COMMIT;
