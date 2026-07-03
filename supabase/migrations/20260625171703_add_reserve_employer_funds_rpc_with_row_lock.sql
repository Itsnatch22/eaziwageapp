
CREATE OR REPLACE FUNCTION reserve_employer_funds(
  p_employer_id uuid,
  p_amount numeric,
  p_advance_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_balance numeric;
  v_tx_id uuid;
BEGIN
  -- Lock the employer wallet row to prevent concurrent double-spend
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM public.employer_wallets
  WHERE employer_id = p_employer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Employer wallet not found for employer_id: %', p_employer_id;
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance: available=% requested=%', v_balance, p_amount;
  END IF;

  -- Deduct balance atomically
  UPDATE public.employer_wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Record the reservation transaction
  INSERT INTO public.wallet_transactions (
    wallet_id, amount, type, status, reference, description, metadata
  )
  VALUES (
    v_wallet_id,
    -p_amount,
    'payout',
    'pending',
    'ADV-RESERVE-' || p_advance_id::text,
    'Reserved for advance ' || p_advance_id::text,
    jsonb_build_object('advance_id', p_advance_id)
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- Only authenticated service role can call this — not anon
REVOKE EXECUTE ON FUNCTION reserve_employer_funds(uuid, numeric, uuid) FROM anon, authenticated;

-- Also fix repay_advance_to_admin — add FOR UPDATE on admin wallet
CREATE OR REPLACE FUNCTION repay_advance_to_admin(
  p_advance_id uuid,
  p_amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_wallet_id uuid;
  v_employer_id uuid;
  v_organization_id uuid;
BEGIN
  SELECT employer_id, organization_id
  INTO v_employer_id, v_organization_id
  FROM public.advances
  WHERE id = p_advance_id;

  -- Lock admin wallet row before updating balance
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

  UPDATE public.advances
  SET status = 'repaid', repaid_at = NOW()
  WHERE id = p_advance_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION repay_advance_to_admin(uuid, numeric) FROM anon, authenticated;

