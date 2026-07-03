
-- ============================================================
-- employee_onboarding: consolidate 14 → 7 policies
-- ============================================================

-- Drop redundant/legacy policies
DROP POLICY "employee_onboarding_insert_own" ON employee_onboarding;
DROP POLICY "Employers can insert employees" ON employee_onboarding;
DROP POLICY "Admins can view all employee_onboarding" ON employee_onboarding;
DROP POLICY "employee_onboarding_select_own" ON employee_onboarding;
DROP POLICY "Employers can view own employees" ON employee_onboarding;
DROP POLICY "employee_onboarding_update_own" ON employee_onboarding;
DROP POLICY "Employers can update employees" ON employee_onboarding;
DROP POLICY "Employers can delete employees" ON employee_onboarding;

-- Re-create upgraded employer INSERT (raw subquery → user_owns_employer_onboarding,
-- which already enforces deleted_at IS NULL)
CREATE POLICY "employers_can_insert_employee_onboarding"
  ON employee_onboarding
  FOR INSERT
  TO authenticated
  WITH CHECK (user_owns_employer_onboarding(employer_id));

-- Re-create upgraded employer DELETE (public → authenticated)
CREATE POLICY "employers_can_delete_employee_onboarding"
  ON employee_onboarding
  FOR DELETE
  TO authenticated
  USING (user_owns_employer_onboarding(employer_id));

-- Remaining canonical set after drops + additions:
-- ALL:    admins_have_full_access_to_employee_onboarding
-- INSERT: employees_can_insert_own_onboarding               (auth.uid() = user_id)
-- INSERT: employers_can_insert_employee_onboarding          (user_owns_employer_onboarding)
-- SELECT: employees_can_read_own_onboarding                 (auth.uid() = user_id)
-- SELECT: employers_can_read_employee_onboarding            (user_owns_employer_onboarding OR user_owns_employer_record)
-- UPDATE: employees_can_update_own_pending_onboarding       (user_id + status IN pending/under_review/rejected)
-- UPDATE: employers_can_update_employee_onboarding          (user_owns_employer_onboarding OR user_owns_employer_record)
-- DELETE: employers_can_delete_employee_onboarding          (user_owns_employer_onboarding)

