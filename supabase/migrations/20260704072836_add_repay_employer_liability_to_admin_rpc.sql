-- repay_advance_to_admin settles liability per-advance (requires a real advance_id
-- with a matching repayment_schedules row). But outstanding_liability is recorded
-- in full at funding time (fund_employer_from_admin), which can exceed the sum of
-- repayment_schedules rows when funded float hasn't been fully consumed by
-- disbursed-and-scheduled advances. This RPC settles that remainder directly
-- against the employer's liability balance, with no advance_id required.
CREATE OR REPLACE FUNCTION public.repay_employer_liability_to_admin(
  p_employer_id uuid,
  p_amount numeric,
  p_reference text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_wallet_id uuid;
  v_currency text;
  v_rate numeric;
  v_usd_amount numeric;
BEGIN
  SELECT currency INTO v_currency
  FROM public.employer_wallets
  WHERE employer_id = p_employer_id
  FOR UPDATE;

  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'Employer wallet not found for employer_id: %', p_employer_id;
  END IF;

  v_currency := UPPER(v_currency);

  IF v_currency = 'USD' THEN
    v_rate := 1;
    v_usd_amount := p_amount;
  ELSE
    SELECT rate_to_usd INTO v_rate
    FROM public.exchange_rates
    WHERE UPPER(currency_code) = v_currency;

    IF v_rate IS NULL OR v_rate <= 0 THEN
      RAISE EXCEPTION 'No exchange rate found for currency % — cannot safely credit admin wallet', v_currency;
    END IF;

    v_usd_amount := ROUND(p_amount / v_rate, 6);
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
  SET balance = balance + v_usd_amount, updated_at = NOW()
  WHERE id = v_admin_wallet_id;

  INSERT INTO public.admin_wallet_transactions (
    admin_wallet_id, amount, type, status, description, metadata
  )
  VALUES (
    v_admin_wallet_id,
    v_usd_amount,
    'payout_settlement',
    'completed',
    'Payday recoupment liability settlement for employer ' || p_employer_id,
    jsonb_build_object(
      'employer_id', p_employer_id,
      'local_amount', p_amount,
      'local_currency', v_currency,
      'rate_to_usd', v_rate,
      'reference', p_reference
    )
  );

  UPDATE public.employer_wallets
  SET total_repaid = total_repaid + p_amount,
      outstanding_liability = GREATEST(outstanding_liability - p_amount, 0),
      updated_at = NOW()
  WHERE employer_id = p_employer_id;
END;
$$;
