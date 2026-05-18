ALTER TABLE public.employer_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_have_full_access_to_employer_onboarding" ON employer_onboarding;
DROP POLICY IF EXISTS "employers_can_read_own_onboarding" ON employer_onboarding;
DROP POLICY IF EXISTS "employees_can_read_linked_employer_onboarding" ON employer_onboarding;
DROP POLICY IF EXISTS "employers_can_insert_own_onboarding" ON employer_onboarding;
DROP POLICY IF EXISTS "employers_can_update_own_onboarding" ON employer_onboarding;

CREATE POLICY "admins_have_full_access_to_employer_onboarding"
ON employer_onboarding
FOR ALL
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "employers_can_read_own_onboarding"
ON employer_onboarding
FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "employees_can_read_linked_employer_onboarding"
ON employer_onboarding
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND public.user_has_employee_onboarding_for_employer(id)
);

CREATE POLICY "employers_can_insert_own_onboarding"
ON employer_onboarding
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employers_can_update_own_onboarding"
ON employer_onboarding
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND deleted_at IS NULL)
WITH CHECK (auth.uid() = user_id);
