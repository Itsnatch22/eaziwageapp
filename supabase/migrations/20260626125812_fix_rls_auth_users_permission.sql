
-- Fix admin_all_wallets: replace auth.users query with JWT claim check
DROP POLICY IF EXISTS "admin_all_wallets" ON employer_wallets;
CREATE POLICY "admin_all_wallets" ON employer_wallets
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin', 'super_admin'])
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin', 'super_admin'])
  );

-- Fix admin_all_wallet_tx: replace auth.users query with JWT claim check
DROP POLICY IF EXISTS "admin_all_wallet_tx" ON wallet_transactions;
CREATE POLICY "admin_all_wallet_tx" ON wallet_transactions
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin', 'super_admin'])
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = ANY (ARRAY['admin', 'super_admin'])
  );

