-- Align user_e_invites with API routes (media_kind, payment_status, prompt).
-- Run after 046 (or any first version of user_e_invites). Idempotent.

BEGIN;

ALTER TABLE user_e_invites ADD COLUMN IF NOT EXISTS media_kind TEXT;
ALTER TABLE user_e_invites ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE user_e_invites ADD COLUMN IF NOT EXISTS prompt TEXT;

UPDATE user_e_invites SET media_kind = 'static' WHERE media_kind IS NULL OR TRIM(BOTH FROM media_kind) = '';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_e_invites'
          AND column_name = 'status'
    ) THEN
        UPDATE user_e_invites
        SET payment_status = CASE status::text
            WHEN 'awaiting_payment' THEN 'unpaid'
            WHEN 'paid' THEN 'paid'
            WHEN 'cancelled' THEN 'failed'
            ELSE 'unpaid'
        END
        WHERE payment_status IS NULL OR TRIM(BOTH FROM payment_status) = '';
    END IF;
END $$;

UPDATE user_e_invites SET payment_status = 'unpaid' WHERE payment_status IS NULL OR TRIM(BOTH FROM payment_status) = '';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_e_invites'
          AND column_name = 'prompt_used'
    ) THEN
        UPDATE user_e_invites
        SET prompt = prompt_used
        WHERE (prompt IS NULL OR TRIM(BOTH FROM prompt) = '') AND prompt_used IS NOT NULL;
    END IF;
END $$;

ALTER TABLE user_e_invites ALTER COLUMN media_kind SET DEFAULT 'static';
ALTER TABLE user_e_invites ALTER COLUMN payment_status SET DEFAULT 'unpaid';

ALTER TABLE user_e_invites ALTER COLUMN media_kind SET NOT NULL;
ALTER TABLE user_e_invites ALTER COLUMN payment_status SET NOT NULL;

DROP INDEX IF EXISTS idx_user_e_invites_status;
CREATE INDEX IF NOT EXISTS idx_user_e_invites_payment_status ON user_e_invites (payment_status);

COMMIT;
