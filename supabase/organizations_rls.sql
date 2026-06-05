
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_users_can_read_their_organization" ON organizations;

CREATE POLICY "authenticated_users_can_read_their_organization"
ON organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE public.profiles.organization_id = public.organizations.id
    AND public.profiles.id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE public.employees.organization_id = public.organizations.id
    AND public.employees.user_id = auth.uid()
  )
);