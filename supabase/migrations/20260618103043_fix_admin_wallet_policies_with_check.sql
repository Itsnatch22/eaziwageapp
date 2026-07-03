
DROP POLICY IF EXISTS admin_only_wallets ON public.admin_wallets;
CREATE POLICY admin_only_wallets ON public.admin_wallets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
      AND (users.raw_app_meta_data ->> 'role') = ANY (ARRAY['admin', 'super_admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
      AND (users.raw_app_meta_data ->> 'role') = ANY (ARRAY['admin', 'super_admin'])
    )
  );

DROP POLICY IF EXISTS admin_only_wallet_tx ON public.admin_wallet_transactions;
CREATE POLICY admin_only_wallet_tx ON public.admin_wallet_transactions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
      AND (users.raw_app_meta_data ->> 'role') = ANY (ARRAY['admin', 'super_admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
      AND (users.raw_app_meta_data ->> 'role') = ANY (ARRAY['admin', 'super_admin'])
    )
  );

