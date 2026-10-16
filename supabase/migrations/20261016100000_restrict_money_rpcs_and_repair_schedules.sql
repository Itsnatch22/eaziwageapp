-- Financial and PII RPCs are internal server-side operations.
REVOKE ALL ON FUNCTION public.credit_employer_wallet_prefunded(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fund_employer_from_admin(uuid, uuid, numeric, numeric, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_employee_disbursement_from_treasury(uuid, numeric, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_employer_reservation(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.repay_advance_to_admin(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.repay_employer_liability_to_admin(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_employer_funds(uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transfer_admin_treasury_funds(text, text, text, numeric, numeric, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_employer_live_bank_account(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_employer_bank_account(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_employee_account_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_employer_bank_account(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_employer_account_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_payment_method_pii(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.credit_employer_wallet_prefunded(uuid, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fund_employer_from_admin(uuid, uuid, numeric, numeric, text, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_employee_disbursement_from_treasury(uuid, numeric, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_employer_reservation(uuid, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.repay_advance_to_admin(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.repay_employer_liability_to_admin(uuid, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_employer_funds(uuid, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_admin_treasury_funds(text, text, text, numeric, numeric, numeric, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_employer_live_bank_account(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_employer_bank_account(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_employee_account_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_employer_bank_account(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_employer_account_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_payment_method_pii(uuid, text, text, text) TO service_role;

-- Recovery can create a schedule repeatedly without duplicating one advance's obligation.
CREATE UNIQUE INDEX IF NOT EXISTS repayment_schedules_advance_id_key
  ON public.repayment_schedules (advance_id);

-- Employee-submitted onboarding cannot approve itself or pre-bind to a live employee.
DROP POLICY IF EXISTS employees_can_insert_own_onboarding ON public.employee_onboarding;
CREATE POLICY employees_can_insert_own_onboarding
  ON public.employee_onboarding
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND live_employer_id IS NULL
  );

DROP POLICY IF EXISTS employees_can_update_own_pending_onboarding ON public.employee_onboarding;
CREATE POLICY employees_can_update_own_pending_onboarding
  ON public.employee_onboarding
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status IN ('pending', 'under_review', 'rejected')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('pending', 'under_review', 'rejected')
    AND live_employer_id IS NULL
  );

-- Employee inserts cannot assert that their own destination is verified.
DROP POLICY IF EXISTS "Employees can insert own payment methods" ON public.payment_methods;
CREATE POLICY "Employees can insert own payment methods"
  ON public.payment_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT e.id
      FROM public.employees e
      WHERE e.user_id = auth.uid()
    )
    AND is_verified = false
    AND verification_status = 'unverified'
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

-- No employee self-insert policy; employee creation is managed by trusted flows.
DROP POLICY IF EXISTS employees_can_insert_own_record ON public.employees;
