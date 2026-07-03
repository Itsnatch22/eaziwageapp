
-- ============================================================
-- 2.10: api_health — restrict INSERT to service_role only
-- ============================================================
DROP POLICY IF EXISTS "API" ON api_health;

CREATE POLICY "api_health_insert_service_role"
  ON api_health
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- 2.11: risk_review_requests — deduplicate + add admin policies
-- ============================================================

-- Drop duplicates
DROP POLICY IF EXISTS "review_requests_insert_own" ON risk_review_requests;
DROP POLICY IF EXISTS "review_requests_select_own" ON risk_review_requests;

-- Rebuild canonical user policies cleanly
DROP POLICY IF EXISTS "pol_review_requests_insert" ON risk_review_requests;
CREATE POLICY "pol_review_requests_insert"
  ON risk_review_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "pol_review_requests_select" ON risk_review_requests;
CREATE POLICY "pol_review_requests_select"
  ON risk_review_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin SELECT: read all review requests
DROP POLICY IF EXISTS "admin_review_requests_select" ON risk_review_requests;
CREATE POLICY "admin_review_requests_select"
  ON risk_review_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );

-- Admin UPDATE: approve/reject review requests
DROP POLICY IF EXISTS "admin_review_requests_update" ON risk_review_requests;
CREATE POLICY "admin_review_requests_update"
  ON risk_review_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = true
    )
  );

