BEGIN;

ALTER TABLE platform_settings
    ADD COLUMN IF NOT EXISTS e_invite_static_inr INT NOT NULL DEFAULT 300,
    ADD COLUMN IF NOT EXISTS e_invite_animated_inr INT NOT NULL DEFAULT 500;

UPDATE platform_settings
SET
    e_invite_static_inr = COALESCE(NULLIF(e_invite_static_inr, 0), 300),
    e_invite_animated_inr = COALESCE(NULLIF(e_invite_animated_inr, 0), 500),
    updated_at = NOW()
WHERE id = 'default';

COMMIT;
