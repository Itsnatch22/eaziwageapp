-- reserve_employer_funds() tagged its ADV-RESERVE- hold row as type='payout', the
-- same type the DusuPay webhook uses for its own PAY-<merchantRef> row inserted at
-- actual disbursement completion. For any advance that gets disbursed and later
-- repaid, BOTH rows end up 'completed' with amount ≈ -advance.amount — double
-- counting every real disbursement in the employer wallet page's "Total Disbursed"
-- card (app/dashboards/employer-dashboard/wallet/page.tsx) and in
-- lib/services/report-generation.ts's totalWithdrawals. Giving the reservation row
-- its own type stops it from ever being summed alongside genuine payout rows again,
-- without deleting either row (both still needed: one tracks the funds hold/release
-- lifecycle, the other is the real "money left the building" audit record).
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT wallet_transactions_type_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type = ANY (ARRAY['deposit'::text, 'withdrawal'::text, 'payout'::text, 'refund'::text, 'arrears_payment'::text, 'reservation'::text]));

CREATE OR REPLACE FUNCTION public.reserve_employer_funds(p_employer_id uuid, p_amount numeric, p_advance_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet_id uuid;
  v_total_advanced numeric;
  v_total_repaid numeric;
  v_reserved_amount numeric;
  v_available numeric;
  v_tx_id uuid;
BEGIN
  SELECT
    id,
    total_advanced,
    total_repaid,
    reserved_amount
  INTO v_wallet_id, v_total_advanced, v_total_repaid, v_reserved_amount
  FROM public.employer_wallets
  WHERE employer_id = p_employer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Employer wallet not found for employer_id: %', p_employer_id;
  END IF;

  v_available := v_total_advanced - v_total_repaid - v_reserved_amount;

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance: available=% requested=%', v_available, p_amount;
  END IF;

  UPDATE public.employer_wallets
  SET reserved_amount = reserved_amount + p_amount,
      updated_at = NOW()
  WHERE employer_id = p_employer_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, amount, type, status, reference, description, metadata
  )
  VALUES (
    v_wallet_id,
    -p_amount,
    'reservation',
    'pending',
    'ADV-RESERVE-' || p_advance_id::text,
    'Reserved for advance ' || p_advance_id::text,
    jsonb_build_object('advance_id', p_advance_id)
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$function$;

-- Backfill the one existing reservation row that was still tagged 'payout'.
UPDATE public.wallet_transactions
SET type = 'reservation'
WHERE reference LIKE 'ADV-RESERVE-%' AND type = 'payout';
