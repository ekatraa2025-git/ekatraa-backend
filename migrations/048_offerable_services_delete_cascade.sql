-- Ensure deleting an offerable service cleans up linkage rows safely.
BEGIN;

DO $$
DECLARE
    fk RECORD;
BEGIN
    IF to_regclass('public.service_occasions') IS NOT NULL THEN
        ALTER TABLE public.service_occasions
            DROP CONSTRAINT IF EXISTS service_occasions_service_id_fkey;

        FOR fk IN
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'service_occasions'
              AND c.contype = 'f'
              AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (service_id)%REFERENCES %offerable_services(id)%'
        LOOP
            EXECUTE format('ALTER TABLE public.service_occasions DROP CONSTRAINT %I', fk.conname);
        END LOOP;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'service_occasions'
              AND c.conname = 'service_occasions_service_id_fkey'
        ) THEN
            ALTER TABLE public.service_occasions
                ADD CONSTRAINT service_occasions_service_id_fkey
                FOREIGN KEY (service_id)
                REFERENCES public.offerable_services(id)
                ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

DO $$
DECLARE
    fk RECORD;
BEGIN
    IF to_regclass('public.services') IS NOT NULL THEN
        ALTER TABLE public.services
            DROP CONSTRAINT IF EXISTS services_catalog_service_id_fkey;

        FOR fk IN
            SELECT c.conname
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'services'
              AND c.contype = 'f'
              AND pg_get_constraintdef(c.oid) ILIKE 'FOREIGN KEY (catalog_service_id)%REFERENCES %offerable_services(id)%'
        LOOP
            EXECUTE format('ALTER TABLE public.services DROP CONSTRAINT %I', fk.conname);
        END LOOP;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'services'
              AND c.conname = 'services_catalog_service_id_fkey'
        ) THEN
            ALTER TABLE public.services
                ADD CONSTRAINT services_catalog_service_id_fkey
                FOREIGN KEY (catalog_service_id)
                REFERENCES public.offerable_services(id)
                ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

COMMIT;
