ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_have_full_access_to_employers" ON employers;
DROP POLICY IF EXISTS "employers_can_read_own_record" ON employers;
DROP POLICY IF EXISTS "employees_can_read_their_employer_record" ON employers;
DROP POLICY IF EXISTS "employers_can_insert_own_record" ON employers;
DROP POLICY IF EXISTS "employers_can_update_own_record" ON employers;

CREATE POLICY "admins_have_full_access_to_employers"
ON employers
FOR ALL
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "employers_can_read_own_record"
ON employers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "employees_can_read_their_employer_record"
ON employers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.employer_id = employers.id
      AND e.user_id = auth.uid()
  )
);

CREATE POLICY "employers_can_insert_own_record"
ON employers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employers_can_update_own_record"
ON employers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
