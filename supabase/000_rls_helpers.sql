CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_employer_onboarding(employer_onboarding_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employer_onboarding
    WHERE id = employer_onboarding_id
      AND user_id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_employer_record(employer_record_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employers
    WHERE id = employer_record_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_employee_onboarding_for_employer(employer_onboarding_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_onboarding
    WHERE employer_id = employer_onboarding_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_employee_onboarding(employee_onboarding_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_onboarding eo
    WHERE eo.id = employee_onboarding_id
      AND (
        eo.user_id = auth.uid()
        OR public.user_owns_employer_onboarding(eo.employer_id)
        OR public.user_owns_employer_record(eo.employer_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_employer_can_read_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_onboarding eo
    WHERE eo.user_id = profile_user_id
      AND public.user_owns_employer_onboarding(eo.employer_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_employee_can_read_employer_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_onboarding eo
    JOIN public.employer_onboarding emp
      ON emp.id = eo.employer_id
    WHERE eo.user_id = auth.uid()
      AND emp.user_id = profile_user_id
      AND emp.deleted_at IS NULL
  );
$$;
