
-- ============================================================
-- 3.3: login_history — drop redundant INSERT timestamp trigger
-- update_login_history_timestamp() is just NEW.logged_in_at = NOW()
-- Column already has DEFAULT now() — trigger is dead weight
-- Check dependents before dropping function
-- ============================================================
DROP TRIGGER IF EXISTS set_login_history_timestamp ON login_history;

-- Only drop function if no other triggers use it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE action_statement ILIKE '%update_login_history_timestamp%'
  ) THEN
    DROP FUNCTION IF EXISTS update_login_history_timestamp();
  END IF;
END $$;

-- ============================================================
-- 3.4: notifications — drop redundant INSERT created_at trigger
-- set_created_at() is just NEW.created_at = NOW()
-- Column already has DEFAULT now() — trigger is dead weight
-- set_created_at() has only this one dependent — safe to drop
-- ============================================================
DROP TRIGGER IF EXISTS set_notifications_created_at ON notifications;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE action_statement ILIKE '%set_created_at%'
  ) THEN
    DROP FUNCTION IF EXISTS set_created_at();
  END IF;
END $$;

