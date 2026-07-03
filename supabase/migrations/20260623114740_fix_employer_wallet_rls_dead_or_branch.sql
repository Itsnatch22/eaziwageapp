
-- The second OR branch (employers.id = employer_wallets.employer_id) is dead code —
-- employers.id and employer_onboarding.id are different UUID spaces.
-- Wallet FK is employer_onboarding.id. Bridge is employers.onboarding_id.
-- Fix: resolve through the bridge correctly.

DROP POLICY IF EXISTS "employer_view_own_wallet" ON employer_wallets;

CREATE POLICY "employer_view_own_wallet"
  ON employer_wallets
  FOR SELECT
  TO authenticated
  USING (
    employer_id IN (
      SELECT eo.id
      FROM employer_onboarding eo
      WHERE eo.user_id = auth.uid()
      UNION
      -- Resolve live employer → onboarding bridge
      SELECT e.onboarding_id
      FROM employers e
      WHERE e.user_id = auth.uid()
        AND e.onboarding_id IS NOT NULL
    )
  );

