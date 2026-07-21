-- Multi-currency treasury model and P4 employer-funding correction.
-- Real cash movement is only EaziWage -> employee and employer -> EaziWage
-- repayment. Employer top-up/credit-line approval is ledger-only.

ALTER TABLE public.admin_wallets
  ADD COLUMN IF NOT EXISTS country_code text;

ALTER TABLE public.admin_wallets
  ADD COLUMN IF NOT EXISTS cumulative_rounding_remainder_usd numeric NOT NULL DEFAULT 0;

ALTER TABLE public.admin_wallets
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS branch_name text,
  ADD COLUMN IF NOT EXISTS branch_code text,
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS swift_code text,
  ADD COLUMN IF NOT EXISTS paybill_number text,
  ADD COLUMN IF NOT EXISTS supports_mpesa_deposit boolean NOT NULL DEFAULT false;

UPDATE public.admin_wallets
SET country_code = COALESCE(country_code, 'KE')
WHERE name = 'Main Stanbic Source';

UPDATE public.admin_wallets
SET account_number = COALESCE(account_number, '0100016602986'),
    bank_name = COALESCE(bank_name, 'Stanbic Bank'),
    branch_name = COALESCE(branch_name, 'Westgate Branch'),
    branch_code = COALESCE(branch_code, '012'),
    bank_code = COALESCE(bank_code, '31'),
    swift_code = COALESCE(swift_code, 'SBICKENX'),
    paybill_number = NULL,
    supports_mpesa_deposit = false
WHERE name = 'Main Stanbic Source'
  AND UPPER(COALESCE(currency, 'USD')) = 'USD';

INSERT INTO public.admin_wallets (name, balance, currency, country_code)
SELECT 'Stanbic KES Account - Kenya', 0, 'KES', 'KE'
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_wallets
  WHERE country_code = 'KE' AND UPPER(currency) = 'KES'
);

UPDATE public.admin_wallets
SET account_number = COALESCE(account_number, '0100016602967'),
    bank_name = COALESCE(bank_name, 'Stanbic Bank'),
    branch_name = COALESCE(branch_name, 'Westgate Branch'),
    branch_code = COALESCE(branch_code, '012'),
    bank_code = COALESCE(bank_code, '31'),
    swift_code = COALESCE(swift_code, 'SBICKENX'),
    paybill_number = COALESCE(paybill_number, '600100'),
    supports_mpesa_deposit = true
WHERE country_code = 'KE'
  AND UPPER(currency) = 'KES';

ALTER TABLE public.employers
  ADD COLUMN IF NOT EXISTS repayment_currency_preference text NOT NULL DEFAULT 'local';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employers_repayment_currency_preference_check'
      AND conrelid = 'public.employers'::regclass
  ) THEN
    ALTER TABLE public.employers
      ADD CONSTRAINT employers_repayment_currency_preference_check
      CHECK (repayment_currency_preference IN ('usd', 'local'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.cash_requirement_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date date NOT NULL,
  country_code text NOT NULL,
  currency text NOT NULL,
  total_required_amount numeric NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  calculation_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forecast_date, country_code, currency)
);

ALTER TABLE public.cash_requirement_forecasts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_requirement_forecasts'
      AND (
        policyname = 'cash_requirement_forecasts_admin_select'
        OR (
          cmd = 'SELECT'
          AND qual ILIKE '%profiles%'
          AND qual ILIKE '%role%'
          AND qual ILIKE '%admin%'
        )
      )
  ) THEN
    CREATE POLICY cash_requirement_forecasts_admin_select
    ON public.cash_requirement_forecasts
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cash_requirement_forecasts'
      AND (
        policyname = 'cash_requirement_forecasts_service_all'
        OR (
          cmd = 'ALL'
          AND 'service_role' = ANY (roles)
        )
      )
  ) THEN
    CREATE POLICY cash_requirement_forecasts_service_all
    ON public.cash_requirement_forecasts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  ALTER TABLE public.admin_wallet_transactions DROP CONSTRAINT IF EXISTS admin_wallet_transactions_type_check;

  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.admin_wallet_transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%'
    AND pg_get_constraintdef(oid) ILIKE '%payout_settlement%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.admin_wallet_transactions DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.admin_wallet_transactions
    ADD CONSTRAINT admin_wallet_transactions_type_check
    CHECK (type = ANY (ARRAY[
      'stanbic_deposit',
      'dusupay_funding',
      'fee_collection',
      'payout_settlement',
      'employee_disbursement',
      'internal_treasury_transfer',
      'adjustment'
    ]::text[]));
END $$;

CREATE OR REPLACE FUNCTION public.approve_employer_credit_line(
  p_employer_id uuid,
  p_amount numeric,
  p_currency text,
  p_wallet_transaction_id uuid,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  SELECT id INTO v_wallet_id
  FROM public.employer_wallets
  WHERE employer_id = p_employer_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.employer_wallets (
      employer_id, total_advanced, outstanding_liability, total_repaid, reserved_amount, currency, updated_at
    )
    VALUES (
      p_employer_id, p_amount, p_amount, 0, 0, UPPER(COALESCE(p_currency, 'KES')), now()
    )
    RETURNING id INTO v_wallet_id;
  ELSE
    UPDATE public.employer_wallets
    SET total_advanced = total_advanced + p_amount,
        outstanding_liability = outstanding_liability + p_amount,
        currency = UPPER(COALESCE(p_currency, currency, 'KES')),
        updated_at = now()
    WHERE id = v_wallet_id;
  END IF;

  UPDATE public.wallet_transactions
  SET status = 'completed',
      amount = p_amount,
      local_currency = UPPER(COALESCE(p_currency, local_currency, 'KES')),
      metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'admin_id', p_admin_id,
          'employer_id', p_employer_id,
          'approved_as', 'ledger_only_credit_line',
          'real_money_moved', false
        )
  WHERE id = p_wallet_transaction_id
    AND wallet_id = v_wallet_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending wallet transaction % not found for employer %', p_wallet_transaction_id, p_employer_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_employee_disbursement_from_treasury(
  p_advance_id uuid,
  p_amount numeric,
  p_country_code text,
  p_currency text,
  p_reference text,
  p_internal_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet_id uuid;
  v_currency text := UPPER(COALESCE(p_currency, 'KES'));
  v_country text := UPPER(COALESCE(p_country_code, 'KE'));
BEGIN
  SELECT id INTO v_wallet_id
  FROM public.admin_wallets
  WHERE UPPER(country_code) = v_country
    AND UPPER(currency) = v_currency
  LIMIT 1
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Treasury wallet not found for country=% currency=%', v_country, v_currency;
  END IF;

  UPDATE public.admin_wallets
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO public.admin_wallet_transactions (
    admin_wallet_id, amount, type, status, reference, description, metadata
  )
  VALUES (
    v_wallet_id,
    -p_amount,
    'employee_disbursement',
    'completed',
    p_reference,
    'Employee advance disbursement',
    jsonb_build_object(
      'advance_id', p_advance_id,
      'country_code', v_country,
      'currency', v_currency,
      'internal_reference', p_internal_reference,
      'source', 'dusupay_payout'
    )
  )
  ON CONFLICT (reference) DO NOTHING;

  RETURN v_wallet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_admin_treasury_funds(
  p_country_code text,
  p_from_currency text,
  p_to_currency text,
  p_from_amount numeric,
  p_to_amount numeric,
  p_rate_snapshot numeric,
  p_reference text,
  p_admin_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from_wallet uuid;
  v_to_wallet uuid;
  v_country text := UPPER(COALESCE(p_country_code, 'KE'));
  v_from_currency text := UPPER(p_from_currency);
  v_to_currency text := UPPER(p_to_currency);
BEGIN
  IF p_from_amount <= 0 OR p_to_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amounts must be positive';
  END IF;

  SELECT id INTO v_from_wallet
  FROM public.admin_wallets
  WHERE UPPER(country_code) = v_country AND UPPER(currency) = v_from_currency
  LIMIT 1
  FOR UPDATE;

  SELECT id INTO v_to_wallet
  FROM public.admin_wallets
  WHERE UPPER(country_code) = v_country AND UPPER(currency) = v_to_currency
  LIMIT 1
  FOR UPDATE;

  IF v_from_wallet IS NULL OR v_to_wallet IS NULL THEN
    RAISE EXCEPTION 'Treasury wallets not found for country=% from=% to=%', v_country, v_from_currency, v_to_currency;
  END IF;

  UPDATE public.admin_wallets
  SET balance = balance - p_from_amount, updated_at = now()
  WHERE id = v_from_wallet;

  UPDATE public.admin_wallets
  SET balance = balance + p_to_amount, updated_at = now()
  WHERE id = v_to_wallet;

  INSERT INTO public.admin_wallet_transactions (admin_wallet_id, amount, type, status, reference, description, metadata)
  VALUES
    (
      v_from_wallet,
      -p_from_amount,
      'internal_treasury_transfer',
      'completed',
      p_reference,
      COALESCE(p_description, 'Internal treasury transfer'),
      jsonb_build_object('admin_id', p_admin_id, 'country_code', v_country, 'from_currency', v_from_currency, 'to_currency', v_to_currency, 'rate_snapshot', p_rate_snapshot, 'leg', 'source')
    ),
    (
      v_to_wallet,
      p_to_amount,
      'internal_treasury_transfer',
      'completed',
      p_reference,
      COALESCE(p_description, 'Internal treasury transfer'),
      jsonb_build_object('admin_id', p_admin_id, 'country_code', v_country, 'from_currency', v_from_currency, 'to_currency', v_to_currency, 'rate_snapshot', p_rate_snapshot, 'leg', 'destination')
    );
END;
$$;

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
  v_country_code text;
  v_preference text;
  v_settlement_currency text;
  v_rate_to_usd numeric := 1;
  v_settlement_amount numeric;
  v_exact_settlement_amount numeric;
  v_rounding_remainder_usd numeric := 0;
  v_wallet_id uuid;
BEGIN
  SELECT
    a.employer_id,
    a.organization_id,
    UPPER(COALESCE(a.currency, 'KES')),
    CASE UPPER(TRIM(COALESCE(e.country, 'KE')))
      WHEN 'KENYA' THEN 'KE'
      WHEN 'UGANDA' THEN 'UG'
      WHEN 'TANZANIA' THEN 'TZ'
      WHEN 'RWANDA' THEN 'RW'
      ELSE UPPER(TRIM(COALESCE(e.country, 'KE')))
    END,
    COALESCE(e.repayment_currency_preference, 'local')
  INTO v_employer_id, v_organization_id, v_currency, v_country_code, v_preference
  FROM public.advances a
  LEFT JOIN public.employers e ON e.id = a.employer_id
  WHERE a.id = p_advance_id;

  IF v_employer_id IS NULL THEN
    RAISE EXCEPTION 'Advance % not found', p_advance_id;
  END IF;

  v_settlement_currency := CASE WHEN v_preference = 'usd' THEN 'USD' ELSE v_currency END;

  IF v_currency <> 'USD' THEN
    SELECT rate_to_usd INTO v_rate_to_usd
    FROM public.exchange_rates
    WHERE UPPER(currency_code) = v_currency;
  END IF;

  IF v_settlement_currency = 'USD' AND v_currency <> 'USD' THEN
    IF v_rate_to_usd IS NULL OR v_rate_to_usd <= 0 THEN
      RAISE EXCEPTION 'No exchange rate found for currency %', v_currency;
    END IF;
    v_exact_settlement_amount := p_amount / v_rate_to_usd;
    v_settlement_amount := ROUND(v_exact_settlement_amount, 6);
    v_rounding_remainder_usd := v_exact_settlement_amount - v_settlement_amount;
  ELSE
    v_exact_settlement_amount := p_amount;
    v_settlement_amount := p_amount;
    v_rounding_remainder_usd := 0;
  END IF;

  SELECT id INTO v_admin_wallet_id
  FROM public.admin_wallets
  WHERE UPPER(country_code) = v_country_code
    AND UPPER(currency) = v_settlement_currency
  LIMIT 1
  FOR UPDATE;

  IF v_admin_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Admin wallet not found for country=% currency=%', v_country_code, v_settlement_currency;
  END IF;

  UPDATE public.admin_wallets
  SET balance = balance + v_settlement_amount,
      cumulative_rounding_remainder_usd = cumulative_rounding_remainder_usd + v_rounding_remainder_usd,
      updated_at = NOW()
  WHERE id = v_admin_wallet_id;

  INSERT INTO public.admin_wallet_transactions (
    admin_wallet_id, amount, type, status, description, metadata
  )
  VALUES (
    v_admin_wallet_id,
    v_settlement_amount,
    'payout_settlement',
    'completed',
    'Repayment for advance ' || p_advance_id,
    jsonb_build_object(
      'advance_id', p_advance_id,
      'employer_id', v_employer_id,
      'liability_amount_local', p_amount,
      'liability_currency', v_currency,
      'settlement_currency', v_settlement_currency,
      'settlement_amount_exact', v_exact_settlement_amount,
      'repayment_currency_preference', v_preference,
      'rate_to_usd', v_rate_to_usd,
      'rounding_remainder_usd', v_rounding_remainder_usd
    )
  );

  SELECT id INTO v_wallet_id FROM public.employer_wallets WHERE employer_id = v_employer_id FOR UPDATE;

  UPDATE public.employer_wallets
  SET total_repaid = total_repaid + p_amount,
      reserved_amount = GREATEST(reserved_amount - p_amount, 0),
      outstanding_liability = GREATEST(outstanding_liability - p_amount, 0),
      last_repayment_at = NOW(),
      updated_at = NOW()
  WHERE employer_id = v_employer_id;

  IF v_wallet_id IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, amount, type, status, description, reference, metadata, local_currency, rate_snapshot, usd_amount
    )
    VALUES (
      v_wallet_id,
      p_amount,
      'arrears_payment',
      'completed',
      'Repayment for advance ' || p_advance_id,
      'ARR-' || p_advance_id::text,
      jsonb_build_object('advance_id', p_advance_id, 'employer_id', v_employer_id, 'settlement_currency', v_settlement_currency),
      v_currency,
      v_rate_to_usd,
      CASE
        WHEN v_currency = 'USD' THEN p_amount
        WHEN v_rate_to_usd IS NULL OR v_rate_to_usd <= 0 THEN NULL
        ELSE ROUND(p_amount / v_rate_to_usd, 6)
      END
    )
    ON CONFLICT (reference) DO NOTHING;
  END IF;

  UPDATE public.wallet_transactions
  SET status = 'completed'
  WHERE reference = 'ADV-RESERVE-' || p_advance_id::text
    AND status = 'pending';

  UPDATE public.advances
  SET status = 'repaid', repaid_at = NOW()
  WHERE id = p_advance_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_cash_requirement_forecast(p_forecast_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  WITH employee_rows AS (
    SELECT
      e.id,
      CASE UPPER(TRIM(COALESCE(e.country, 'KE')))
        WHEN 'KENYA' THEN 'KE'
        WHEN 'UGANDA' THEN 'UG'
        WHEN 'TANZANIA' THEN 'TZ'
        WHEN 'RWANDA' THEN 'RW'
        ELSE UPPER(TRIM(COALESCE(e.country, 'KE')))
      END AS country_code,
      CASE UPPER(TRIM(COALESCE(e.country, 'KE')))
        WHEN 'KE' THEN 'KES'
        WHEN 'KENYA' THEN 'KES'
        WHEN 'UG' THEN 'UGX'
        WHEN 'UGANDA' THEN 'UGX'
        WHEN 'TZ' THEN 'TZS'
        WHEN 'TANZANIA' THEN 'TZS'
        WHEN 'RW' THEN 'RWF'
        WHEN 'RWANDA' THEN 'RWF'
        ELSE 'KES'
      END AS currency,
      COALESCE(e.monthly_salary, 0)::numeric AS monthly_salary,
      COALESCE(emp.advance_limit_percent, 50)::numeric AS advance_limit_percent,
      GREATEST(1, EXTRACT(day FROM (date_trunc('month', p_forecast_date) + interval '1 month - 1 day')))::numeric AS days_in_month,
      LEAST(
        EXTRACT(day FROM p_forecast_date)::numeric,
        GREATEST(1, EXTRACT(day FROM (date_trunc('month', p_forecast_date) + interval '1 month - 1 day')))::numeric
      ) AS days_worked_so_far,
      COALESCE((
        SELECT pur.deductions::numeric
        FROM public.payroll_upload_rows pur
        WHERE pur.live_employee_id = e.id
        ORDER BY pur.created_at DESC
        LIMIT 1
      ), 0) AS statutory_deductions
    FROM public.employees e
    JOIN public.employers emp ON emp.id = e.employer_id
    WHERE e.status = 'Active'
  ),
  calculated AS (
    SELECT
      country_code,
      currency,
      id,
      GREATEST(
        (monthly_salary * (advance_limit_percent / 100) * (days_worked_so_far / days_in_month)) - statutory_deductions,
        0
      ) AS max_draw,
      monthly_salary,
      advance_limit_percent,
      days_worked_so_far,
      days_in_month,
      statutory_deductions
    FROM employee_rows
  ),
  grouped AS (
    SELECT
      country_code,
      currency,
      SUM(max_draw) AS total_required_amount,
      COUNT(*)::int AS employee_count,
      jsonb_agg(jsonb_build_object(
        'employee_id', id,
        'max_draw', max_draw,
        'monthly_salary', monthly_salary,
        'advance_limit_percent', advance_limit_percent,
        'days_worked_so_far', days_worked_so_far,
        'days_in_month', days_in_month,
        'statutory_deductions', statutory_deductions
      )) AS calculation_details
    FROM calculated
    GROUP BY country_code, currency
  )
  INSERT INTO public.cash_requirement_forecasts (
    forecast_date, country_code, currency, total_required_amount, employee_count, calculation_details, updated_at
  )
  SELECT p_forecast_date, country_code, currency, total_required_amount, employee_count, calculation_details, now()
  FROM grouped
  ON CONFLICT (forecast_date, country_code, currency)
  DO UPDATE SET
    total_required_amount = EXCLUDED.total_required_amount,
    employee_count = EXCLUDED.employee_count,
    calculation_details = EXCLUDED.calculation_details,
    updated_at = now();
END;
$$;
