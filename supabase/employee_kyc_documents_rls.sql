ALTER TABLE public.employee_kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_have_full_access_to_employee_kyc_documents" ON employee_kyc_documents;
DROP POLICY IF EXISTS "employees_can_read_own_kyc_documents" ON employee_kyc_documents;
DROP POLICY IF EXISTS "employees_can_insert_own_kyc_documents" ON employee_kyc_documents;
DROP POLICY IF EXISTS "employees_can_update_own_pending_kyc_documents" ON employee_kyc_documents;
DROP POLICY IF EXISTS "employers_can_read_employee_kyc_documents" ON employee_kyc_documents;

CREATE POLICY "admins_have_full_access_to_employee_kyc_documents"
ON employee_kyc_documents
FOR ALL
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());

CREATE POLICY "employees_can_read_own_kyc_documents"
ON employee_kyc_documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "employees_can_insert_own_kyc_documents"
ON employee_kyc_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employees_can_update_own_pending_kyc_documents"
ON employee_kyc_documents
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status IN ('pending', 'rejected'))
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employers_can_read_employee_kyc_documents"
ON employee_kyc_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.employee_onboarding eo
    WHERE eo.user_id = employee_kyc_documents.user_id
      AND public.user_owns_employer_onboarding(eo.employer_id)
  )
);
