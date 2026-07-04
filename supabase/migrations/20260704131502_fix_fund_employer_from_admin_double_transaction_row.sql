-- Approving a pending top-up request called this RPC (which unconditionally
-- inserts its own new 'completed' wallet_transactions row) and then separately
-- flipped the ORIGINAL pending request row to 'completed' too — crediting the
-- employer's displayed balance (summed from wallet_transactions) twice for a
-- single real deposit, while employer_wallets.total_advanced/outstanding_liability
-- only ever incremented once. New optional p_existing_wallet_transaction_id lets
-- a caller that already has a pending row (the top-up approval flow) update it
-- in place instead of getting a second, referenceless row. Direct funding with
-- no prior request (app/api/admin/payouts/fund-employer) passes NULL and keeps
-- the original insert-a-new-row behavior.
CREATE OR REPLACE FUNCTION public.fund_employer_from_admin(
  p_employer_id uuid,
  p_admin_wallet_id uuid,
  p_amount_usd numeric,
  p_amount_local numeric,
  p_description text,
  p_admin_id uuid,
  p_currency text DEFAULT 'KES'::text,
  p_existing_wallet_transaction_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet_id uuid;
  v_admin_balance numeric;
BEGIN
  -- Lock admin wallet row and check balance (admin_wallets is USD-denominated)
  SELECT balance INTO v_admin_balance
  FROM public.admin_wallets
  WHERE id = p_admin_wallet_id
  FOR UPDATE;

  IF v_admin_balance IS NULL THEN
    RAISE EXCEPTION 'Admin wallet not found: %', p_admin_wallet_id;
  END IF;

  IF v_admin_balance < p_amount_usd THEN
    RAISE EXCEPTION 'Insufficient funds in admin wallet: available=% requested=%',
      v_admin_balance, p_amount_usd;
  END IF;

  -- Deduct from admin wallet (USD)
  UPDATE public.admin_wallets
  SET balance = balance - p_amount_usd, updated_at = NOW()
  WHERE id = p_admin_wallet_id;

  -- Record admin debit (USD)
  INSERT INTO public.admin_wallet_transactions (
    admin_wallet_id, amount, type, status, description, metadata
  )
  VALUES (
    p_admin_wallet_id,
    -p_amount_usd,
    'dusupay_funding',
    'completed',
    p_description,
    jsonb_build_object('employer_id', p_employer_id, 'admin_id', p_admin_id)
  );

  -- Upsert employer wallet using correct columns (employer_wallets/wallet_transactions
  -- are local-currency-denominated — must use p_amount_local, NOT the USD figure)
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
    p_amount_local,
    p_amount_local,
    0,
    p_currency,
    NOW()
  )
  ON CONFLICT (employer_id)
  DO UPDATE SET
    total_advanced = employer_wallets.total_advanced + p_amount_local,
    outstanding_liability = employer_wallets.outstanding_liability + p_amount_local,
    updated_at = NOW();

  -- Resolve wallet id
  SELECT id INTO v_wallet_id
  FROM public.employer_wallets
  WHERE employer_id = p_employer_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Failed to resolve employer wallet for employer_id: %', p_employer_id;
  END IF;

  IF p_existing_wallet_transaction_id IS NOT NULL THEN
    -- A pending request row already represents this deposit — complete it in
    -- place rather than logging the same money twice.
    UPDATE public.wallet_transactions
    SET status = 'completed',
        amount = p_amount_local,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('admin_id', p_admin_id, 'employer_id', p_employer_id)
    WHERE id = p_existing_wallet_transaction_id
      AND wallet_id = v_wallet_id;
  ELSE
    -- No prior request — record the employer credit (local currency) fresh.
    INSERT INTO public.wallet_transactions (
      wallet_id, amount, type, status, description, metadata
    )
    VALUES (
      v_wallet_id,
      p_amount_local,
      'deposit',
      'completed',
      p_description,
      jsonb_build_object('admin_id', p_admin_id, 'employer_id', p_employer_id)
    );
  END IF;
END;
$function$;
