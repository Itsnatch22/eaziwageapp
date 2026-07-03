-- repay_advance_to_admin previously credited admin_wallets.balance (USD-
-- denominated) with the raw advance amount in whatever LOCAL currency it was
-- disbursed in (KES/UGX/TZS/RWF), with no conversion — e.g. a KES 500
-- repayment added a full $500 to the admin's USD balance (a ~129x
-- overstatement) instead of the correct $3.87. This corrupts the real admin
-- wallet balance, not just its display, and gets worse with every automated
-- payday-recoupment collection. Fixed to convert to USD before crediting the
-- balance and before recording the transaction, mirroring how
-- fund_employer_from_admin already stores true USD values in `amount` (its
-- callers pre-convert). Original local amount/currency/rate are preserved in
-- metadata for audit traceability — no schema change needed.
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
  v_currency text;
  v_rate numeric;
  v_usd_amount numeric;
BEGIN
  SELECT employer_id, organization_id, currency
  INTO v_employer_id, v_organization_id, v_currency
  FROM public.advances
  WHERE id = p_advance_id;

  IF v_employer_id IS NULL THEN
    RAISE EXCEPTION 'Advance % not found', p_advance_id;
  END IF;

  v_currency := UPPER(COALESCE(v_currency, 'KES'));

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
    'Repayment for advance ' || p_advance_id,
    jsonb_build_object(
      'advance_id', p_advance_id,
      'employer_id', v_employer_id,
      'local_amount', p_amount,
      'local_currency', v_currency,
      'rate_to_usd', v_rate
    )
  );

  -- Lock and settle the employer wallet: repayment reduces what they owe
  -- (outstanding_liability, recorded in full at funding time by
  -- fund_employer_from_admin), and releases the reservation held against
  -- this specific advance. This side stays in the employer's LOCAL currency
  -- (p_amount) — employer_wallets is denominated per-employer, unlike the
  -- USD admin wallet above.
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
