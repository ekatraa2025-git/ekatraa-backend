-- Align active flag with verified vendors (one-time data fix for existing rows)

BEGIN;

UPDATE public.vendors
SET
  status = 'active',
  is_active = true
WHERE COALESCE(is_verified, false) = true
  AND (
    COALESCE(status, '') <> 'active'
    OR COALESCE(is_active, false) = false
  );

COMMIT;
