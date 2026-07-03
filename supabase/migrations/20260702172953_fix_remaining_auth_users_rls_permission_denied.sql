-- These policies reference auth.users directly, which the authenticated/anon
-- Postgres roles have no SELECT grant on — every one of them has been failing
-- with "permission denied for table users" (42501) whenever evaluated for a
-- non-service-role request. Replace the admin checks with the same
-- system_admins / profiles.role pattern already used correctly elsewhere in
-- this schema (e.g. cookie_consents, dusupay_transactions, meeting_logs's own
-- admin_select policy), and replace the auth.users email lookup in
-- meeting_logs_own_select with auth.email(), which reads from the JWT and
-- needs no table grant at all.

DROP POLICY IF EXISTS admin_only_wallet_tx ON admin_wallet_transactions;
CREATE POLICY admin_only_wallet_tx ON admin_wallet_transactions
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

DROP POLICY IF EXISTS admin_only_wallets ON admin_wallets;
CREATE POLICY admin_only_wallets ON admin_wallets
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

DROP POLICY IF EXISTS admin_all_blackout_periods ON blackout_periods;
CREATE POLICY admin_all_blackout_periods ON blackout_periods
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

DROP POLICY IF EXISTS admin_only_dusupay_mirror ON dusupay_wallet_mirror;
CREATE POLICY admin_only_dusupay_mirror ON dusupay_wallet_mirror
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

DROP POLICY IF EXISTS admin_all_global_settings ON global_settings;
CREATE POLICY admin_all_global_settings ON global_settings
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

DROP POLICY IF EXISTS admin_all_legal_docs ON legal_documents;
CREATE POLICY admin_all_legal_docs ON legal_documents
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

DROP POLICY IF EXISTS admins_have_full_access_to_organizations ON organizations;
CREATE POLICY admins_have_full_access_to_organizations ON organizations
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

DROP POLICY IF EXISTS admin_all_audit_logs ON system_audit_logs;
CREATE POLICY admin_all_audit_logs ON system_audit_logs
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

DROP POLICY IF EXISTS "Admins can view all feedback" ON termination_feedback;
CREATE POLICY "Admins can view all feedback" ON termination_feedback
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

DROP POLICY IF EXISTS meeting_logs_own_select ON meeting_logs;
CREATE POLICY meeting_logs_own_select ON meeting_logs
  FOR SELECT
  USING (user_email = auth.email());
