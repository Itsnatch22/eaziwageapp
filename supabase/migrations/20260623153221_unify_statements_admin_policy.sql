
-- Drop the statements policy that uses system_admins join (inconsistent with other admin policies)
DROP POLICY IF EXISTS statements_admin_select ON statements;

-- Recreate using raw_app_meta_data role check — consistent with admin_reports policies
-- and reliable since app_metadata is set server-side only
CREATE POLICY statements_admin_select ON statements
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

