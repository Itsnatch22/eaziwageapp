
-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Policies for organizations table
-- Allows authenticated users to read organizations they belong to
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "authenticated_users_can_read_their_organization" ON organizations;

-- Authenticated users can read organizations they belong to via profiles or employees
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