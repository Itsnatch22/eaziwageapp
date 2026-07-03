
DROP POLICY IF EXISTS employer_view_own_wallet ON public.employer_wallets;
CREATE POLICY employer_view_own_wallet ON public.employer_wallets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employer_onboarding
      WHERE employer_onboarding.id = employer_wallets.employer_id
        AND employer_onboarding.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.employers
      WHERE employers.id = employer_wallets.employer_id
        AND employers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS employer_view_own_wallet_tx ON public.wallet_transactions;
CREATE POLICY employer_view_own_wallet_tx ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employer_wallets
      JOIN public.employer_onboarding
        ON employer_onboarding.id = employer_wallets.employer_id
      WHERE employer_wallets.id = wallet_transactions.wallet_id
        AND employer_onboarding.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.employer_wallets
      JOIN public.employers
        ON employers.id = employer_wallets.employer_id
      WHERE employer_wallets.id = wallet_transactions.wallet_id
        AND employers.user_id = auth.uid()
    )
  );

