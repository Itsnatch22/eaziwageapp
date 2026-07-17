-- P4: the payout leg (debit_order/invoice employers) needs the employer's
-- LIVE bank account, not the onboarding-time one. admin_get_employer_bank_account()
-- only reads employer_onboarding.bank_account_number, but bank_change_requests
-- can update the live employers row post-promotion without touching onboarding
-- — using the onboarding-keyed RPC here risks paying out to a stale account.
CREATE OR REPLACE FUNCTION public.admin_get_employer_live_bank_account(p_employer_id uuid, p_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_result text;
BEGIN
  SELECT pgp_sym_decrypt(bank_account_number, p_key)::text
  INTO v_result
  FROM public.employers
  WHERE id = p_employer_id
  LIMIT 1;
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_get_employer_live_bank_account(uuid, text) FROM anon, authenticated;
