
-- ============================================================
-- Fix mutable search_path — all functions except
-- compute_earnings_for_employee (broken composite type, handled separately)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_deposit(p_wallet_id uuid, p_amount numeric, p_reference text, p_description text)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN
  UPDATE public.admin_wallets SET balance = balance + p_amount, updated_at = NOW() WHERE id = p_wallet_id;
  INSERT INTO public.admin_wallet_transactions (admin_wallet_id, amount, type, status, reference, description)
  VALUES (p_wallet_id, p_amount, 'stanbic_deposit', 'completed', p_reference, p_description);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_failed_logins()
RETURNS integer LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM failed_login_attempts WHERE attempted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_sync_employer_risk_score()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
DECLARE v_rating TEXT;
BEGIN
  v_rating := CASE WHEN NEW.composite_score >= 4.0 THEN 'A' WHEN NEW.composite_score >= 3.0 THEN 'B' WHEN NEW.composite_score >= 2.6 THEN 'C' ELSE 'D' END;
  UPDATE employer_onboarding SET risk_score = NEW.composite_score, risk_rating = v_rating, updated_at = now() WHERE id = NEW.employer_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fund_employer_from_admin(p_employer_id uuid, p_admin_wallet_id uuid, p_amount numeric, p_description text, p_admin_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
DECLARE v_wallet_id UUID;
BEGIN
  UPDATE public.admin_wallets SET balance = balance - p_amount, updated_at = NOW() WHERE id = p_admin_wallet_id;
  INSERT INTO public.admin_wallet_transactions (admin_wallet_id, amount, type, status, description, metadata)
  VALUES (p_admin_wallet_id, -p_amount, 'dusupay_funding', 'completed', p_description, jsonb_build_object('employer_id', p_employer_id, 'admin_id', p_admin_id));
  INSERT INTO public.employer_wallets (employer_id, balance) VALUES (p_employer_id, 0)
  ON CONFLICT (employer_id) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_wallet_id;
  INSERT INTO public.wallet_transactions (wallet_id, amount, type, status, description, metadata)
  VALUES (v_wallet_id, p_amount, 'deposit', 'completed', p_description, jsonb_build_object('admin_id', p_admin_id));
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_employee_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN
  IF NEW.employee_code IS NULL THEN NEW.employee_code := 'EMP-' || lpad(nextval('employee_code_seq')::text, 6, '0'); END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_employer_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN
  IF NEW.employer_code IS NULL THEN NEW.employer_code := 'EMP-' || lpad(nextval('employer_code_seq')::text, 6, '0'); END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_account_lock_status(p_email character varying)
RETURNS TABLE(is_locked boolean, failed_attempts integer, locked_until timestamp with time zone)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
DECLARE
  v_failed_attempts INTEGER; v_most_recent_attempt TIMESTAMP WITH TIME ZONE;
  v_locked_until TIMESTAMP WITH TIME ZONE;
  v_max_attempts INTEGER := 5; v_window_minutes INTEGER := 15; v_lockout_minutes INTEGER := 15;
BEGIN
  SELECT COUNT(*), MAX(attempted_at) INTO v_failed_attempts, v_most_recent_attempt
  FROM failed_login_attempts WHERE email = LOWER(p_email) AND attempted_at > NOW() - INTERVAL '1 minute' * v_window_minutes;
  IF v_failed_attempts >= v_max_attempts THEN
    v_locked_until := v_most_recent_attempt + INTERVAL '1 minute' * v_lockout_minutes;
    IF v_locked_until > NOW() THEN RETURN QUERY SELECT true, v_failed_attempts, v_locked_until;
    ELSE RETURN QUERY SELECT false, 0, NULL::TIMESTAMP WITH TIME ZONE; END IF;
  ELSE RETURN QUERY SELECT false, v_failed_attempts, NULL::TIMESTAMP WITH TIME ZONE; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_failed_login_count(p_email text, p_minutes integer DEFAULT 15)
RETURNS integer LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
DECLARE attempt_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attempt_count FROM failed_login_attempts
  WHERE email = LOWER(p_email) AND attempted_at >= NOW() - (p_minutes || ' minutes')::INTERVAL;
  RETURN COALESCE(attempt_count, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_account_locked(p_email text, p_max_attempts integer DEFAULT 5, p_window_minutes integer DEFAULT 15, p_lockout_minutes integer DEFAULT 15)
RETURNS TABLE(locked boolean, attempts integer, locked_until timestamp with time zone)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
DECLARE v_attempts INTEGER; v_most_recent TIMESTAMPTZ; v_locked_until TIMESTAMPTZ;
BEGIN
  SELECT COUNT(*), MAX(attempted_at) INTO v_attempts, v_most_recent FROM failed_login_attempts
  WHERE email = LOWER(p_email) AND attempted_at >= NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  v_attempts := COALESCE(v_attempts, 0);
  IF v_attempts >= p_max_attempts THEN
    v_locked_until := v_most_recent + (p_lockout_minutes || ' minutes')::INTERVAL;
    IF NOW() < v_locked_until THEN RETURN QUERY SELECT TRUE, v_attempts, v_locked_until;
    ELSE RETURN QUERY SELECT FALSE, v_attempts, NULL::TIMESTAMPTZ; END IF;
  ELSE RETURN QUERY SELECT FALSE, v_attempts, NULL::TIMESTAMPTZ; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.repay_advance_to_admin(p_advance_id uuid, p_amount numeric)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
DECLARE v_admin_wallet_id UUID; v_employer_id UUID; v_organization_id UUID;
BEGIN
  SELECT employer_id, organization_id INTO v_employer_id, v_organization_id FROM public.advances WHERE id = p_advance_id;
  SELECT id INTO v_admin_wallet_id FROM public.admin_wallets WHERE name = 'Main Stanbic Source' LIMIT 1;
  UPDATE public.admin_wallets SET balance = balance + p_amount, updated_at = NOW() WHERE id = v_admin_wallet_id;
  INSERT INTO public.admin_wallet_transactions (admin_wallet_id, amount, type, status, description, metadata)
  VALUES (v_admin_wallet_id, p_amount, 'payout_settlement', 'completed', 'Repayment for advance ' || p_advance_id, jsonb_build_object('advance_id', p_advance_id, 'employer_id', v_employer_id));
  UPDATE public.advances SET status = 'repaid', repaid_at = NOW() WHERE id = p_advance_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_created_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN NEW.created_at = NOW(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_employer_risk_score()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
DECLARE v_rating TEXT;
BEGIN
  v_rating := CASE WHEN NEW.composite_score >= 4.0 THEN 'A' WHEN NEW.composite_score >= 3.0 THEN 'B' WHEN NEW.composite_score >= 2.6 THEN 'C' ELSE 'D' END;
  UPDATE employer_onboarding SET risk_score = NEW.composite_score, risk_rating = v_rating, updated_at = now() WHERE id = NEW.employer_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_admin_reports_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_login_history_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN NEW.logged_in_at = NOW(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_meeting_types_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN NEW.updated_at = TIMEZONE('utc'::text, NOW()); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_scheduled_meetings_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN NEW.updated_at = TIMEZONE('utc'::text, NOW()); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_wiza_public_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

