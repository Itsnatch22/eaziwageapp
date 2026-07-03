
CREATE OR REPLACE FUNCTION public.fund_employer_from_admin(
  p_employer_id uuid,
  p_admin_wallet_id uuid,
  p_amount numeric,
  p_description text,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_wallet_id UUID;
  v_admin_balance numeric;
BEGIN
  -- Lock admin wallet row and check balance (prevents race conditions)
  SELECT balance INTO v_admin_balance
  FROM public.admin_wallets
  WHERE id = p_admin_wallet_id
  FOR UPDATE;

  IF v_admin_balance IS NULL THEN
    RAISE EXCEPTION 'Admin wallet not found: %', p_admin_wallet_id;
  END IF;

  IF v_admin_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds in admin wallet: available=% requested=%', v_admin_balance, p_amount;
  END IF;

  -- Deduct from admin wallet
  UPDATE public.admin_wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = p_admin_wallet_id;

  -- Record admin debit
  INSERT INTO public.admin_wallet_transactions (admin_wallet_id, amount, type, status, description, metadata)
  VALUES (
    p_admin_wallet_id,
    -p_amount,
    'dusupay_funding',
    'completed',
    p_description,
    jsonb_build_object('employer_id', p_employer_id, 'admin_id', p_admin_id)
  );

  -- Upsert employer wallet — THEN resolve wallet_id via SELECT (avoids broken RETURNING on conflict)
  INSERT INTO public.employer_wallets (employer_id, balance)
  VALUES (p_employer_id, p_amount)
  ON CONFLICT (employer_id)
  DO UPDATE SET balance = employer_wallets.balance + p_amount, updated_at = NOW();

  -- Resolve wallet id cleanly after upsert
  SELECT id INTO v_wallet_id
  FROM public.employer_wallets
  WHERE employer_id = p_employer_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Failed to resolve employer wallet for employer_id: %', p_employer_id;
  END IF;

  -- Record employer credit
  INSERT INTO public.wallet_transactions (wallet_id, amount, type, status, description, metadata)
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

