
DROP POLICY IF EXISTS "admin_notifications: admin read" ON public.admin_notifications;

CREATE POLICY "admin_notifications: admin read" ON public.admin_notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.system_admins
    WHERE system_admins.id = auth.uid() AND system_admins.is_admin = true
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND lower(profiles.role::text) IN ('admin','super_admin','compliance','employer_admin')
  )
);

