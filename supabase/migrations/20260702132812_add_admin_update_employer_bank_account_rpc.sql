CREATE OR REPLACE FUNCTION public.admin_update_employer_bank_account(
  p_onboarding_id uuid,
  p_bank_name text,
  p_account_number text,
  p_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_encrypted bytea;
BEGIN
  v_encrypted := pgp_sym_encrypt(p_account_number, p_key);

  UPDATE public.employer_onboarding
  SET
    bank_name = p_bank_name,
    bank_account_number = v_encrypted,
    updated_at = now()
  WHERE id = p_onboarding_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'employer_onboarding row not found for id %', p_onboarding_id;
  END IF;

  UPDATE public.employers
  SET
    bank_name = p_bank_name,
    bank_account_number = v_encrypted,
    updated_at = now()
  WHERE onboarding_id = p_onboarding_id;
END;
$function$;
