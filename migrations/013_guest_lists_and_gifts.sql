BEGIN;

CREATE TABLE IF NOT EXISTS guest_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    relation TEXT,
    group_name TEXT,
    notes TEXT,
    rsvp TEXT DEFAULT 'pending',
    invited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_lists_user_id ON guest_lists(user_id);

CREATE TABLE IF NOT EXISTS guest_gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    guest_id UUID REFERENCES guest_lists(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'cash',
    amount NUMERIC DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_gifts_user_id ON guest_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_guest_gifts_guest_id ON guest_gifts(guest_id);

COMMIT;
