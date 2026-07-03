-- ============================================================
-- 1. RLS policies for payment_method_verifications (was RLS-enabled, zero policies)
--    Employee can see/update only their own OTP verification record.
--    No client INSERT/DELETE (server/service-role only).
-- ============================================================
CREATE POLICY "Admins have full access to payment method verifications"
  ON public.payment_method_verifications
  FOR ALL
  TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

CREATE POLICY "Employees can view own payment method verification"
  ON public.payment_method_verifications
  FOR SELECT
  TO authenticated
  USING (
    payment_method_id IN (
      SELECT pm.id FROM public.payment_methods pm
      JOIN public.employees e ON e.id = pm.employee_id
      WHERE e.user_id = auth.uid()
    )
  );

CREATE POLICY "Employees can update own payment method verification"
  ON public.payment_method_verifications
  FOR UPDATE
  TO authenticated
  USING (
    payment_method_id IN (
      SELECT pm.id FROM public.payment_methods pm
      JOIN public.employees e ON e.id = pm.employee_id
      WHERE e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    payment_method_id IN (
      SELECT pm.id FROM public.payment_methods pm
      JOIN public.employees e ON e.id = pm.employee_id
      WHERE e.user_id = auth.uid()
    )
  );

-- ============================================================
-- 2. RLS policies for fraud_flags (was RLS-enabled, zero policies)
--    Admin: full access. Employer: read-only visibility into their own flags.
-- ============================================================
CREATE POLICY "Admins have full access to fraud flags"
  ON public.fraud_flags
  FOR ALL
  TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

CREATE POLICY "Employers can view their own fraud flags"
  ON public.fraud_flags
  FOR SELECT
  TO authenticated
  USING (
    employer_id IS NOT NULL
    AND user_owns_employer_record(employer_id)
  );

-- ============================================================
-- 3. RLS policies for employer_repayments (was RLS-enabled, zero policies)
--    Admin: full access. Employer: read-only visibility into their own repayments.
-- ============================================================
CREATE POLICY "Admins have full access to employer repayments"
  ON public.employer_repayments
  FOR ALL
  TO authenticated
  USING (current_user_is_admin())
  WITH CHECK (current_user_is_admin());

CREATE POLICY "Employers can view their own repayments"
  ON public.employer_repayments
  FOR SELECT
  TO authenticated
  USING (user_owns_employer_record(employer_id));

-- ============================================================
-- 4. Pin search_path on the 6 functions the linter flagged as mutable.
--    No logic changes — definitions preserved exactly, only SET search_path added.
--    (compute_earnings_for_employee remains broken/dead — references a
--     non-existent `payroll_entries` table — this only closes the search_path
--     hole, it does not make the function callable.)
-- ============================================================
ALTER FUNCTION public.compute_earnings_for_employee(uuid, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_payment_method_changes() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_payment_method_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_wallet_topup() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_kyc_status_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_risk_review_request() SET search_path = public, pg_temp;

-- ============================================================
-- 5. Revoke unused `anon` grants on sensitive tables.
--    None of these tables have any anon-role RLS policy (all access is
--    authenticated-only via auth.uid()), so anon never had real row access —
--    this just removes the table-level GRANT, which also stops these tables
--    from being discoverable in the public (unauthenticated) GraphQL schema.
--    `authenticated` grants are left untouched since real RLS-scoped access
--    depends on them.
-- ============================================================
REVOKE ALL ON public.fraud_flags FROM anon;
REVOKE ALL ON public.employer_repayments FROM anon;
REVOKE ALL ON public.payment_method_verifications FROM anon;
REVOKE ALL ON public.payment_method_audit FROM anon;
REVOKE ALL ON public.payment_methods FROM anon;
REVOKE ALL ON public.system_mfa_backup_codes FROM anon;
REVOKE ALL ON public.system_push_subscriptions FROM anon;

