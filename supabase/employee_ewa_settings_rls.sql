ALTER TABLE public.employee_ewa_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_have_full_access_to_employee_ewa_settings" ON employee_ewa_settings;
DROP POLICY IF EXISTS "employees_can_read_own_ewa_settings" ON employee_ewa_settings;
DROP POLICY IF EXISTS "employers_can_read_employee_ewa_settings" ON employee_ewa_settings;
DROP POLICY IF EXISTS "employers_can_manage_employee_ewa_settings" ON employee_ewa_settings;

CREATE POLICY "admins_have_full_access_to_employee_ewa_settings"
ON employee_ewa_settings
FOR ALL
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "employees_can_read_own_ewa_settings"
ON employee_ewa_settings
FOR SELECT
TO authenticated
USING (public.user_can_access_employee_onboarding(employee_onboarding_id));

CREATE POLICY "employers_can_read_employee_ewa_settings"
ON employee_ewa_settings
FOR SELECT
TO authenticated
USING (public.user_owns_employer_onboarding(employer_id));

CREATE POLICY "employers_can_manage_employee_ewa_settings"
ON employee_ewa_settings
FOR ALL
TO authenticated
USING (public.user_owns_employer_onboarding(employer_id))
WITH CHECK (
  public.user_owns_employer_onboarding(employer_id)
  AND updated_by = auth.uid()
);
