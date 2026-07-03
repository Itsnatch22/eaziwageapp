
-- The UPDATE policy was checking profiles.is_admin which is a different column
-- from system_admins.is_admin. Align UPDATE with the SELECT policy so mark-as-read
-- actually works for all system admins.
DROP POLICY IF EXISTS "admin_notifications: admin update" ON admin_notifications;

CREATE POLICY "admin_notifications: admin update"
ON admin_notifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM system_admins
    WHERE system_admins.id = auth.uid()
      AND system_admins.is_admin = true
  )
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND lower(profiles.role::text) = ANY (ARRAY['admin', 'super_admin', 'compliance', 'employer_admin'])
  )
);

