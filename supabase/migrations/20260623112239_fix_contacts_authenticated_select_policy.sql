
-- Drop the over-permissive policy
DROP POLICY "Allow admin select" ON contacts;

-- Replace with system_admins-only SELECT
CREATE POLICY "system_admins_can_read_contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_admins
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );

