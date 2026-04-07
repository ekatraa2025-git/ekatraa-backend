-- Final invoice from vendor after order completion (OTP). Customer accepts → total_amount updated for balance pay.
CREATE TABLE IF NOT EXISTS public.order_vendor_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'accepted')),
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    cgst_rate NUMERIC NOT NULL DEFAULT 0,
    sgst_rate NUMERIC NOT NULL DEFAULT 0,
    cgst_amount NUMERIC NOT NULL DEFAULT 0,
    sgst_amount NUMERIC NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    vendor_display_name TEXT,
    vendor_logo_url TEXT,
    vendor_gstin TEXT,
    invoice_number TEXT,
    notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_vendor_invoices_order_id ON public.order_vendor_invoices (order_id);
CREATE INDEX IF NOT EXISTS idx_order_vendor_invoices_vendor_id ON public.order_vendor_invoices (vendor_id);

COMMENT ON TABLE public.order_vendor_invoices IS 'Vendor-submitted itemized invoice with GST; customer acceptance updates order total for balance payment.';
