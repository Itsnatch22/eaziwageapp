ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_have_full_access_to_employees" ON employees;
DROP POLICY IF EXISTS "employees_can_read_own_record" ON employees;
DROP POLICY IF EXISTS "employers_can_read_their_employees" ON employees;
DROP POLICY IF EXISTS "employees_can_insert_own_record" ON employees;
DROP POLICY IF EXISTS "employees_can_update_own_record" ON employees;
DROP POLICY IF EXISTS "employers_can_update_their_employees" ON employees;

CREATE POLICY "admins_have_full_access_to_employees"
ON employees
FOR ALL
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "employees_can_read_own_record"
ON employees
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "employers_can_read_their_employees"
ON employees
FOR SELECT
TO authenticated
USING (public.user_owns_employer_record(employer_id));

CREATE POLICY "employees_can_insert_own_record"
ON employees
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employees_can_update_own_record"
ON employees
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employers_can_update_their_employees"
ON employees
FOR UPDATE
TO authenticated
USING (public.user_owns_employer_record(employer_id))
WITH CHECK (public.user_owns_employer_record(employer_id));
