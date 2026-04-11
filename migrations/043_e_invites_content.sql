BEGIN;

CREATE TABLE IF NOT EXISTS e_invite_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_key TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    thumbnail_url TEXT,
    preview_url TEXT,
    template_type TEXT DEFAULT 'image',
    duration_seconds INT,
    price NUMERIC(12, 2),
    list_price NUMERIC(12, 2),
    currency TEXT DEFAULT 'INR',
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e_invite_templates_section_active_order
    ON e_invite_templates (section_key, is_active, display_order);

CREATE TABLE IF NOT EXISTS e_invite_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_e_invite_faqs_active_order
    ON e_invite_faqs (is_active, display_order);

INSERT INTO e_invite_templates (
    id, section_key, title, subtitle, thumbnail_url, template_type, duration_seconds,
    price, list_price, display_order, is_active
) VALUES
    ('f1000001-0000-4000-8000-000000000001', 'wedding_cards', 'Garden Soree', 'Elegant floral frame', NULL, 'image', NULL, 1399, 2799, 1, true),
    ('f1000001-0000-4000-8000-000000000002', 'wedding_cards', 'Hazel', 'Minimal pastel wedding invite', NULL, 'image', NULL, 1499, 2999, 2, true),
    ('f1000001-0000-4000-8000-000000000003', 'wedding_cards', 'Black Garden', 'Classic regal layout', NULL, 'image', NULL, 1599, 3199, 3, true),
    ('f1000001-0000-4000-8000-000000000004', 'video_invites', 'Me Before You', 'Animated save-the-date', NULL, 'video', 20, 1799, 2799, 1, true),
    ('f1000001-0000-4000-8000-000000000005', 'video_invites', 'Floral Extravaganza', 'Mehendi special edit', NULL, 'video', 32, 1999, 3999, 2, true),
    ('f1000001-0000-4000-8000-000000000006', 'video_invites', 'We Said Yes', 'Premium cinematic invite', NULL, 'video', 50, 1999, 3999, 3, true),
    ('f1000001-0000-4000-8000-000000000007', 'save_the_date', 'Beyond Words', 'Soft pastel save-the-date', NULL, 'image', NULL, 1299, 2299, 1, true),
    ('f1000001-0000-4000-8000-000000000008', 'save_the_date', 'At Last', 'Travel inspired card', NULL, 'image', NULL, 1399, 2499, 2, true),
    ('f1000001-0000-4000-8000-000000000009', 'save_the_date', 'New Beginning', 'Storybook portrait style', NULL, 'image', NULL, 1499, 2799, 3, true)
ON CONFLICT (id) DO UPDATE SET
    section_key = EXCLUDED.section_key,
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    thumbnail_url = EXCLUDED.thumbnail_url,
    template_type = EXCLUDED.template_type,
    duration_seconds = EXCLUDED.duration_seconds,
    price = EXCLUDED.price,
    list_price = EXCLUDED.list_price,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO e_invite_faqs (id, question, answer, display_order, is_active) VALUES
    (
        'f2000001-0000-4000-8000-000000000001',
        'How are the wedding cards delivered to recipients?',
        'Static e-invites are available for download immediately after payment. We also share WhatsApp-ready and shareable links.',
        1,
        true
    ),
    (
        'f2000001-0000-4000-8000-000000000002',
        'Can I create a wedding card through my phone as well?',
        'Yes. You can create and customize invites directly from your phone. Choose a template, update event details, and share instantly.',
        2,
        true
    ),
    (
        'f2000001-0000-4000-8000-000000000003',
        'Where can I reach out if I face trouble creating or accessing my wedding card?',
        'If you face any issue, contact us at help@ekatraa.in or via WhatsApp support from the Help section.',
        3,
        true
    ),
    (
        'f2000001-0000-4000-8000-000000000004',
        'How to make a digital invitation online?',
        'Pick a template, add names and venue details, preview the invite, and share on WhatsApp or any social app in a few taps.',
        4,
        true
    )
ON CONFLICT (id) DO UPDATE SET
    question = EXCLUDED.question,
    answer = EXCLUDED.answer,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

COMMIT;
