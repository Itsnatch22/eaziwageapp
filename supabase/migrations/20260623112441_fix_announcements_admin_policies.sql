
-- Drop all four broken policies
DROP POLICY "Admins can insert announcements" ON announcements;
DROP POLICY "Admins can view all announcements" ON announcements;
DROP POLICY "Admins can update own drafts" ON announcements;
DROP POLICY "Admins can delete own drafts" ON announcements;

-- SELECT: admins see all announcements
CREATE POLICY "admins_can_view_all_announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

-- INSERT: admins only
CREATE POLICY "admins_can_insert_announcements"
  ON announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (current_user_is_admin());

-- UPDATE: admins, own drafts only
CREATE POLICY "admins_can_update_own_drafts"
  ON announcements
  FOR UPDATE
  TO authenticated
  USING (current_user_is_admin() AND author_id = auth.uid() AND is_draft = true)
  WITH CHECK (current_user_is_admin() AND author_id = auth.uid());

-- DELETE: admins, own drafts only
CREATE POLICY "admins_can_delete_own_drafts"
  ON announcements
  FOR DELETE
  TO authenticated
  USING (current_user_is_admin() AND author_id = auth.uid() AND is_draft = true);

