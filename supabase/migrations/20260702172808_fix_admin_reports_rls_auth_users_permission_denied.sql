DROP POLICY IF EXISTS admins_can_view_all_reports ON admin_reports;
DROP POLICY IF EXISTS admins_can_create_reports ON admin_reports;
DROP POLICY IF EXISTS admins_can_update_reports ON admin_reports;
DROP POLICY IF EXISTS admins_can_delete_reports ON admin_reports;

CREATE POLICY admins_can_view_all_reports ON admin_reports
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

CREATE POLICY admins_can_create_reports ON admin_reports
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
      OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
    )
  );

CREATE POLICY admins_can_update_reports ON admin_reports
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );

CREATE POLICY admins_can_delete_reports ON admin_reports
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role)
  );
