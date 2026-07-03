
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
  v_total_advanced numeric;
  v_total_repaid numeric;
  v_outstanding numeric;
  v_available numeric;
  v_tx_id uuid;
BEGIN
  -- Lock the employer wallet row to prevent concurrent double-spend
  SELECT 
    id, 
    total_advanced,
    total_repaid,
    outstanding_liability
  INTO v_wallet_id, v_total_advanced, v_total_repaid, v_outstanding
  FROM public.employer_wallets
  WHERE employer_id = p_employer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Employer wallet not found for employer_id: %', p_employer_id;
  END IF;

  -- Available = total funded - total repaid - current outstanding
  v_available := v_total_advanced - v_total_repaid - v_outstanding;

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance: available=% requested=%', v_available, p_amount;
  END IF;

  -- Increase outstanding liability atomically
  UPDATE public.employer_wallets
  SET 
    outstanding_liability = outstanding_liability + p_amount,
    updated_at = NOW()
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

