
-- ============================================================
-- 2.14: statements — fix statements_org_select UUID space bug
-- employers.id != organizations.id; must join via employers.organization_id
-- ============================================================
DROP POLICY IF EXISTS "statements_org_select" ON statements;

CREATE POLICY "statements_org_select"
  ON statements
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT e.organization_id
      FROM employers e
      WHERE e.user_id = auth.uid()
        AND e.organization_id IS NOT NULL
    )
  );

