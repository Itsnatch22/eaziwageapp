
DO $$
BEGIN
  IF to_regclass('public.employer_beneficial_owners') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.employer_beneficial_owners ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "admins_have_full_access_to_employer_beneficial_owners" ON public.employer_beneficial_owners';
    EXECUTE 'DROP POLICY IF EXISTS "employers_can_manage_own_beneficial_owners" ON public.employer_beneficial_owners';

    EXECUTE 'CREATE POLICY "admins_have_full_access_to_employer_beneficial_owners"
      ON public.employer_beneficial_owners
      FOR ALL
      TO authenticated
      USING (public.current_user_is_admin())
      WITH CHECK (public.current_user_is_admin())';

    EXECUTE 'CREATE POLICY "employers_can_manage_own_beneficial_owners"
      ON public.employer_beneficial_owners
      FOR ALL
      TO authenticated
      USING (public.user_owns_employer_onboarding(onboarding_id))
      WITH CHECK (public.user_owns_employer_onboarding(onboarding_id))';
  END IF;
END $$;
