
-- 2.7: Drop all four vulnerable policies
DROP POLICY "Admins can view all reports" ON admin_reports;
DROP POLICY "Admins can create reports" ON admin_reports;
DROP POLICY "Admins can update reports" ON admin_reports;
DROP POLICY "Admins can delete reports" ON admin_reports;

-- SELECT: gate on requesting user being admin via app_meta_data
-- (not created_by — system reports with no creator would be invisible otherwise)
CREATE POLICY "admins_can_view_all_reports"
  ON admin_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
        AND (users.raw_app_meta_data ->> 'role') = 'admin'
    )
  );

-- INSERT: gate on inserting user being admin; created_by must match auth.uid()
CREATE POLICY "admins_can_create_reports"
  ON admin_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
        AND (users.raw_app_meta_data ->> 'role') = 'admin'
    )
  );

-- UPDATE: gate on requesting user being admin
CREATE POLICY "admins_can_update_reports"
  ON admin_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
        AND (users.raw_app_meta_data ->> 'role') = 'admin'
    )
  );

-- DELETE: gate on requesting user being admin
CREATE POLICY "admins_can_delete_reports"
  ON admin_reports
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = auth.uid()
        AND (users.raw_app_meta_data ->> 'role') = 'admin'
    )
  );

