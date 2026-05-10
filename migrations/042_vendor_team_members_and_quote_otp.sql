BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    member_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('manager', 'staff')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(vendor_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_vendor_team_members_vendor_status
    ON public.vendor_team_members(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_team_members_member_user
    ON public.vendor_team_members(member_user_id);

ALTER TABLE public.vendor_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_team_members_select" ON public.vendor_team_members;
CREATE POLICY "vendor_team_members_select"
    ON public.vendor_team_members FOR SELECT
    USING (
        auth.uid() = vendor_id
        OR auth.uid() = member_user_id
        OR EXISTS (
            SELECT 1
            FROM public.vendor_team_members vtm
            WHERE vtm.vendor_id = vendor_team_members.vendor_id
              AND vtm.member_user_id = auth.uid()
              AND vtm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "vendor_team_members_insert_owner" ON public.vendor_team_members;
CREATE POLICY "vendor_team_members_insert_owner"
    ON public.vendor_team_members FOR INSERT
    WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "vendor_team_members_update_owner" ON public.vendor_team_members;
CREATE POLICY "vendor_team_members_update_owner"
    ON public.vendor_team_members FOR UPDATE
    USING (auth.uid() = vendor_id)
    WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "vendor_team_members_delete_owner" ON public.vendor_team_members;
CREATE POLICY "vendor_team_members_delete_owner"
    ON public.vendor_team_members FOR DELETE
    USING (auth.uid() = vendor_id);

CREATE TABLE IF NOT EXISTS public.vendor_order_team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    team_member_id UUID NOT NULL REFERENCES public.vendor_team_members(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(order_id, team_member_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_order_team_assignments_vendor
    ON public.vendor_order_team_assignments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_order_team_assignments_order
    ON public.vendor_order_team_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_order_team_assignments_member
    ON public.vendor_order_team_assignments(team_member_id);

ALTER TABLE public.vendor_order_team_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_order_team_assignments_select" ON public.vendor_order_team_assignments;
CREATE POLICY "vendor_order_team_assignments_select"
    ON public.vendor_order_team_assignments FOR SELECT
    USING (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1
            FROM public.vendor_team_members vtm
            WHERE vtm.id = vendor_order_team_assignments.team_member_id
              AND vtm.member_user_id = auth.uid()
              AND vtm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "vendor_order_team_assignments_insert_owner" ON public.vendor_order_team_assignments;
CREATE POLICY "vendor_order_team_assignments_insert_owner"
    ON public.vendor_order_team_assignments FOR INSERT
    WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "vendor_order_team_assignments_update_owner" ON public.vendor_order_team_assignments;
CREATE POLICY "vendor_order_team_assignments_update_owner"
    ON public.vendor_order_team_assignments FOR UPDATE
    USING (auth.uid() = vendor_id)
    WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "vendor_order_team_assignments_delete_owner" ON public.vendor_order_team_assignments;
CREATE POLICY "vendor_order_team_assignments_delete_owner"
    ON public.vendor_order_team_assignments FOR DELETE
    USING (auth.uid() = vendor_id);

CREATE TABLE IF NOT EXISTS public.vendor_quote_otp_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
    team_member_id UUID REFERENCES public.vendor_team_members(id) ON DELETE SET NULL,
    otp_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_quote_otp_vendor_status
    ON public.vendor_quote_otp_challenges(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_vendor_quote_otp_order
    ON public.vendor_quote_otp_challenges(order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quote_otp_team_member
    ON public.vendor_quote_otp_challenges(team_member_id);

ALTER TABLE public.vendor_quote_otp_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_quote_otp_challenges_select" ON public.vendor_quote_otp_challenges;
CREATE POLICY "vendor_quote_otp_challenges_select"
    ON public.vendor_quote_otp_challenges FOR SELECT
    USING (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1
            FROM public.vendor_team_members vtm
            WHERE vtm.id = vendor_quote_otp_challenges.team_member_id
              AND vtm.member_user_id = auth.uid()
              AND vtm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "vendor_quote_otp_challenges_insert" ON public.vendor_quote_otp_challenges;
CREATE POLICY "vendor_quote_otp_challenges_insert"
    ON public.vendor_quote_otp_challenges FOR INSERT
    WITH CHECK (
        auth.uid() = vendor_id
        OR EXISTS (
            SELECT 1
            FROM public.vendor_team_members vtm
            WHERE vtm.id = vendor_quote_otp_challenges.team_member_id
              AND vtm.member_user_id = auth.uid()
              AND vtm.status = 'active'
        )
    );

DROP POLICY IF EXISTS "vendor_quote_otp_challenges_update_owner" ON public.vendor_quote_otp_challenges;
CREATE POLICY "vendor_quote_otp_challenges_update_owner"
    ON public.vendor_quote_otp_challenges FOR UPDATE
    USING (auth.uid() = vendor_id)
    WITH CHECK (auth.uid() = vendor_id);

COMMIT;
