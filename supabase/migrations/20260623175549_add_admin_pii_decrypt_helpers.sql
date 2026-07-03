-- Helper: decrypt employee national_id for admin routes
CREATE OR REPLACE FUNCTION public.admin_get_employee_national_id(
  p_user_id uuid,
  p_key text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
BEGIN
  SELECT pgp_sym_decrypt(national_id, p_key)::text
  INTO v_result
  FROM employee_onboarding
  WHERE user_id = p_user_id
  LIMIT 1;
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Helper: decrypt employer bank_account_number for admin routes
CREATE OR REPLACE FUNCTION public.admin_get_employer_bank_account(
  p_onboarding_id uuid,
  p_key text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result text;
BEGIN
  SELECT pgp_sym_decrypt(bank_account_number, p_key)::text
  INTO v_result
  FROM employer_onboarding
  WHERE id = p_onboarding_id
  LIMIT 1;
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
