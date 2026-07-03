
CREATE POLICY "authenticated_can_read_published_announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (is_draft = false AND published_at IS NOT NULL);

