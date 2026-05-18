ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_have_full_access_to_profiles" ON profiles;
DROP POLICY IF EXISTS "users_can_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "employers_can_read_employee_profiles" ON profiles;
DROP POLICY IF EXISTS "employees_can_read_linked_employer_profile" ON profiles;

CREATE POLICY "admins_have_full_access_to_profiles"
ON profiles
FOR ALL
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "users_can_read_own_profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "employers_can_read_employee_profiles"
ON profiles
FOR SELECT
TO authenticated
USING (public.current_employer_can_read_profile(id));

CREATE POLICY "employees_can_read_linked_employer_profile"
ON profiles
FOR SELECT
TO authenticated
USING (public.current_employee_can_read_employer_profile(id));

CREATE POLICY "users_can_insert_own_profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "users_can_update_own_profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
