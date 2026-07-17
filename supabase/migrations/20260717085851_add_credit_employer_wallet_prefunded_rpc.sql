-- P4: prefunded employers top up via DusuPay collection (their own money).
-- Unlike fund_employer_from_admin(), this is not an admin-fronted loan, so
-- only total_advanced (available balance) increases — outstanding_liability
-- and admin_wallets are deliberately untouched.
CREATE OR REPLACE FUNCTION public.credit_employer_wallet_prefunded(
  p_employer_id uuid,
  p_amount numeric,
  p_wallet_transaction_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet_id uuid;
BEGIN
  SELECT id INTO v_wallet_id
  FROM public.employer_wallets
  WHERE employer_id = p_employer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Employer wallet not found for employer_id: %', p_employer_id;
  END IF;

  UPDATE public.employer_wallets
  SET total_advanced = total_advanced + p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  UPDATE public.wallet_transactions
  SET status = 'completed'
  WHERE id = p_wallet_transaction_id
    AND wallet_id = v_wallet_id;
END;
$function$;
