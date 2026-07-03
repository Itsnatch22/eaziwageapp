
-- ============================================================
-- 2.12: sectors — drop duplicate SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Allow all authenticated users to read sectors" ON sectors;
-- sectors_read remains as the canonical policy

-- ============================================================
-- 2.13 + bonus: employer_risk_factors
--   - drop duplicate SELECT (risk_factors_select_own)
--   - keep pol_risk_factors_employer_select as canonical
--   - add admin full access policy
-- ============================================================
DROP POLICY IF EXISTS "risk_factors_select_own" ON employer_risk_factors;

-- Admin: SELECT, INSERT, UPDATE, DELETE
DROP POLICY IF EXISTS "admins_have_full_access_to_employer_risk_factors" ON employer_risk_factors;
CREATE POLICY "admins_have_full_access_to_employer_risk_factors"
  ON employer_risk_factors
  FOR ALL
  TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

