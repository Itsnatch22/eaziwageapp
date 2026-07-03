
-- ============================================================
-- account_deletion_events — lock down the audit table
-- Writes: service_role only (no authenticated user should INSERT directly)
-- Reads: admin only
-- Deletes: nobody (audit trail is permanent)
-- ============================================================
ALTER TABLE account_deletion_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_account_deletion_events" ON account_deletion_events;
CREATE POLICY "admin_read_account_deletion_events"
  ON account_deletion_events
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

-- Service role bypasses RLS entirely — no INSERT policy needed for it.
-- This ensures NO authenticated user can write to this table directly.

-- ============================================================
-- login_history — 90-day rolling retention cron
-- Matches the same pattern as cleanup-login-events
-- ============================================================
SELECT cron.schedule(
  'cleanup-login-history',
  '0 3 * * *',
  $$
    DELETE FROM public.login_history
    WHERE logged_in_at < now() - interval '90 days';
  $$
);

