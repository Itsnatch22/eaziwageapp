
ALTER TABLE public.employee_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_have_full_access_to_employee_onboarding" ON employee_onboarding;
DROP POLICY IF EXISTS "employees_can_read_own_onboarding" ON employee_onboarding;
DROP POLICY IF EXISTS "employers_can_read_employee_onboarding" ON employee_onboarding;
DROP POLICY IF EXISTS "employees_can_insert_own_onboarding" ON employee_onboarding;
DROP POLICY IF EXISTS "employees_can_update_own_pending_onboarding" ON employee_onboarding;
DROP POLICY IF EXISTS "employers_can_update_employee_onboarding" ON employee_onboarding;

CREATE POLICY "admins_have_full_access_to_employee_onboarding"
ON employee_onboarding
FOR ALL
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "employees_can_read_own_onboarding"
ON employee_onboarding
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "employers_can_read_employee_onboarding"
ON employee_onboarding
FOR SELECT
TO authenticated
USING (
  public.user_owns_employer_onboarding(employer_id)
  OR public.user_owns_employer_record(employer_id)
);

CREATE POLICY "employees_can_insert_own_onboarding"
ON employee_onboarding
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employees_can_update_own_pending_onboarding"
ON employee_onboarding
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status IN ('pending', 'under_review', 'rejected'))
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employers_can_update_employee_onboarding"
ON employee_onboarding
FOR UPDATE
TO authenticated
USING (
  public.user_owns_employer_onboarding(employer_id)
  OR public.user_owns_employer_record(employer_id)
)
WITH CHECK (
  public.user_owns_employer_onboarding(employer_id)
  OR public.user_owns_employer_record(employer_id)
);
