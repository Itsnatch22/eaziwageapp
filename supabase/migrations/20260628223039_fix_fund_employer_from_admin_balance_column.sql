
CREATE OR REPLACE FUNCTION fund_employer_from_admin(
  p_employer_id uuid,
  p_admin_wallet_id uuid,
  p_amount numeric,
  p_description text,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_admin_balance numeric;
BEGIN
  -- Lock admin wallet row and check balance
  SELECT balance INTO v_admin_balance
  FROM public.admin_wallets
  WHERE id = p_admin_wallet_id
  FOR UPDATE;

  IF v_admin_balance IS NULL THEN
    RAISE EXCEPTION 'Admin wallet not found: %', p_admin_wallet_id;
  END IF;

  IF v_admin_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds in admin wallet: available=% requested=%',
      v_admin_balance, p_amount;
  END IF;

  -- Deduct from admin wallet
  UPDATE public.admin_wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = p_admin_wallet_id;

  -- Record admin debit
  INSERT INTO public.admin_wallet_transactions (
    admin_wallet_id, amount, type, status, description, metadata
  )
  VALUES (
    p_admin_wallet_id,
    -p_amount,
    'dusupay_funding',
    'completed',
    p_description,
    jsonb_build_object('employer_id', p_employer_id, 'admin_id', p_admin_id)
  );

  -- Upsert employer wallet using correct columns
  -- total_advanced = cumulative amount funded to this employer
  -- outstanding_liability = what's currently owed (increases on funding)
  INSERT INTO public.employer_wallets (
    employer_id,
    total_advanced,
    outstanding_liability,
    total_repaid,
    currency,
    updated_at
  )
  VALUES (
    p_employer_id,
    p_amount,
    p_amount,
    0,
    'KES',
    NOW()
  )
  ON CONFLICT (employer_id)
  DO UPDATE SET
    total_advanced = employer_wallets.total_advanced + p_amount,
    outstanding_liability = employer_wallets.outstanding_liability + p_amount,
    updated_at = NOW();

  -- Resolve wallet id
  SELECT id INTO v_wallet_id
  FROM public.employer_wallets
  WHERE employer_id = p_employer_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Failed to resolve employer wallet for employer_id: %', p_employer_id;
  END IF;

  -- Record employer credit
  INSERT INTO public.wallet_transactions (
    wallet_id, amount, type, status, description, metadata
  )
  VALUES (
    v_wallet_id,
    p_amount,
    'deposit',
    'completed',
    p_description,
    jsonb_build_object('admin_id', p_admin_id, 'employer_id', p_employer_id)
  );
END;
$$;

