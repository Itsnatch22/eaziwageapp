
-- Drop the broken INSERT policy (uses employee_id = auth.uid() which never matches)
DROP POLICY IF EXISTS employees_request_advances ON public.advances;

-- 1. ADMIN: full access
DROP POLICY IF EXISTS advances_admin_all ON public.advances;
CREATE POLICY advances_admin_all ON public.advances
  FOR ALL
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- 2. EMPLOYEE: SELECT and INSERT their own advances (via employees.user_id)
DROP POLICY IF EXISTS advances_employee_select ON public.advances;
CREATE POLICY advances_employee_select ON public.advances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = public.advances.employee_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS advances_employee_insert ON public.advances;
CREATE POLICY advances_employee_insert ON public.advances
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = public.advances.employee_id
        AND e.user_id = auth.uid()
    )
    AND status = 'pending'
  );

-- 3. EMPLOYER: SELECT and UPDATE advances for their employees
--    (approve/reject flows) — no INSERT or DELETE
DROP POLICY IF EXISTS advances_employer_select ON public.advances;
CREATE POLICY advances_employer_select ON public.advances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = public.advances.employee_id
        AND public.user_owns_employer_record(e.employer_id)
    )
  );

DROP POLICY IF EXISTS advances_employer_update ON public.advances;
CREATE POLICY advances_employer_update ON public.advances
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = public.advances.employee_id
        AND public.user_owns_employer_record(e.employer_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = public.advances.employee_id
        AND public.user_owns_employer_record(e.employer_id)
    )
  );

