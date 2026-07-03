CREATE OR REPLACE FUNCTION public.repay_advance_to_admin(p_advance_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_wallet_id uuid;
  v_employer_id uuid;
  v_organization_id uuid;
BEGIN
  SELECT employer_id, organization_id
  INTO v_employer_id, v_organization_id
  FROM public.advances
  WHERE id = p_advance_id;

  IF v_employer_id IS NULL THEN
    RAISE EXCEPTION 'Advance % not found', p_advance_id;
  END IF;

  SELECT id INTO v_admin_wallet_id
  FROM public.admin_wallets
  WHERE name = 'Main Stanbic Source'
  LIMIT 1
  FOR UPDATE;

  IF v_admin_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Admin wallet not found';
  END IF;

  UPDATE public.admin_wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = v_admin_wallet_id;

  INSERT INTO public.admin_wallet_transactions (
    admin_wallet_id, amount, type, status, description, metadata
  )
  VALUES (
    v_admin_wallet_id,
    p_amount,
    'payout_settlement',
    'completed',
    'Repayment for advance ' || p_advance_id,
    jsonb_build_object('advance_id', p_advance_id, 'employer_id', v_employer_id)
  );

  -- Lock and settle the employer wallet: repayment reduces what they owe
  -- (outstanding_liability, recorded in full at funding time by
  -- fund_employer_from_admin — this RPC previously never brought it back
  -- down, so automated payday-recoupment repayments left utilization %
  -- permanently overstated), and releases the reservation held against
  -- this specific advance.
  PERFORM 1 FROM public.employer_wallets WHERE employer_id = v_employer_id FOR UPDATE;

  UPDATE public.employer_wallets
  SET total_repaid = total_repaid + p_amount,
      reserved_amount = GREATEST(reserved_amount - p_amount, 0),
      outstanding_liability = GREATEST(outstanding_liability - p_amount, 0),
      updated_at = NOW()
  WHERE employer_id = v_employer_id;

  UPDATE public.wallet_transactions
  SET status = 'completed'
  WHERE reference = 'ADV-RESERVE-' || p_advance_id::text
    AND status = 'pending';

  UPDATE public.advances
  SET status = 'repaid', repaid_at = NOW()
  WHERE id = p_advance_id;
END;
$function$;
