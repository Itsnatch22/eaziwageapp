
-- ============================================================
-- employer_onboarding: consolidate 9 → 5 policies
-- ============================================================

-- Drop redundant/legacy policies
DROP POLICY "Employers can insert own profile" ON employer_onboarding;
DROP POLICY "onboarding_insert_own" ON employer_onboarding;
DROP POLICY "Admins can view all employer_onboarding" ON employer_onboarding;
DROP POLICY "Employers can view own profile" ON employer_onboarding;
DROP POLICY "onboarding_select_own" ON employer_onboarding;
DROP POLICY "Employers can update own profile" ON employer_onboarding;
DROP POLICY "onboarding_update_own" ON employer_onboarding;

-- Remaining canonical set:
-- ALL:    admins_have_full_access_to_employer_onboarding   (current_user_is_admin())
-- INSERT: employers_can_insert_own_onboarding              (auth.uid() = user_id)
-- SELECT: employers_can_read_own_onboarding                (user_id + deleted_at IS NULL)
-- SELECT: employees_can_read_linked_employer_onboarding    (deleted_at IS NULL + employee link)
-- UPDATE: employers_can_update_own_onboarding              (user_id + deleted_at IS NULL)

