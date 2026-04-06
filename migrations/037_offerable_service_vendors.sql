-- Optional: restrict catalog offerable_services to specific vendors (admin UI + filtering).
-- Empty set for a service means no restriction (all vendors may list it in portfolio).
CREATE TABLE IF NOT EXISTS public.offerable_service_vendors (
  offerable_service_id UUID NOT NULL REFERENCES public.offerable_services(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (offerable_service_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_offerable_service_vendors_vendor
  ON public.offerable_service_vendors (vendor_id);
