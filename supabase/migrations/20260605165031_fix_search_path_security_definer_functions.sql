
-- ============================================================
-- Fix mutable search_path on all SECURITY DEFINER functions
-- No logic changes — search_path lock only
-- ============================================================

-- 1. current_employer_ids
CREATE OR REPLACE FUNCTION public.current_employer_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT id FROM employer_onboarding WHERE user_id = auth.uid();
$function$;

-- 2. get_employer_advance_summary
CREATE OR REPLACE FUNCTION public.get_employer_advance_summary(
  p_employer_id uuid,
  p_from timestamp with time zone,
  p_to timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_count',     COUNT(*),
    'disbursed_count', COUNT(*) FILTER (WHERE status IN ('disbursed', 'approved')),
    'pending_count',   COUNT(*) FILTER (WHERE status = 'pending'),
    'denied_count',    COUNT(*) FILTER (WHERE status = 'denied'),
    'total_amount',    COALESCE(SUM(amount) FILTER (WHERE status IN ('disbursed', 'approved')), 0),
    'total_fees',      COALESCE(SUM(amount * 0.05) FILTER (WHERE status IN ('disbursed', 'approved')), 0)
  )
  INTO result
  FROM advances
  WHERE employer_id = p_employer_id
    AND created_at >= p_from
    AND created_at <= p_to;

  RETURN result;
END;
$function$;

-- 3. handle_employer_onboarding_approval
CREATE OR REPLACE FUNCTION public.handle_employer_onboarding_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN

    INSERT INTO public.organizations (
      id, name, slug, country_code, currency, country, metadata, created_at, updated_at
    )
    VALUES (
      NEW.id,
      NEW.company_name,
      lower(regexp_replace(NEW.company_name, '\s+', '-', 'g')) || '-' || substr(NEW.id::text, 1, 6),
      COALESCE(NEW.country_code, 'KE'),
      COALESCE(NEW.currency, 'KES'),
      NEW.country,
      COALESCE(NEW.settings, '{}'::jsonb),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.profiles
    SET organization_id = NEW.id
    WHERE id = NEW.user_id
      AND organization_id IS NULL;

    UPDATE public.employees
    SET organization_id = NEW.id
    WHERE employer_id IN (
      SELECT id FROM public.employers WHERE user_id = NEW.user_id
    )
    AND organization_id IS NULL;

  END IF;

  RETURN NEW;
END;
$function$;

-- 4. increment_message_count
CREATE OR REPLACE FUNCTION public.increment_message_count(sid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE wiza_public_sessions
  SET
    message_count = message_count + 2,
    updated_at = NOW()
  WHERE id = sid;
END;
$function$;

-- 5. sync_employee_from_onboarding
CREATE OR REPLACE FUNCTION public.sync_employee_from_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_email text;
  v_name text;
  v_live_employer_id uuid;
  v_employment_type text;
BEGIN
  IF NEW.status = 'approved' THEN
    SELECT e.id
      INTO v_live_employer_id
    FROM public.employer_onboarding eo
    JOIN public.employers e ON e.user_id = eo.user_id
    WHERE eo.id = NEW.employer_id
    LIMIT 1;

    IF v_live_employer_id IS NULL THEN
      SELECT e.id
        INTO v_live_employer_id
      FROM public.employers e
      WHERE e.id = NEW.employer_id
         OR e.employer_id = NEW.employer_id
      LIMIT 1;
    END IF;

    IF v_live_employer_id IS NULL THEN
      RAISE EXCEPTION
        'sync_employee_from_onboarding: live employer row is required. onboarding_employer_id=% employee_user_id=% onboarding_id=%',
        NEW.employer_id, NEW.user_id, NEW.id;
    END IF;

    SELECT COALESCE(NEW.email, NEW.email_placeholder, p.email),
           COALESCE(NEW.full_name, NEW.full_name_placeholder, p.full_name, 'Anonymous')
      INTO v_email, v_name
    FROM public.profiles p
    WHERE p.id = NEW.user_id;

    v_email := COALESCE(v_email, NEW.email, NEW.email_placeholder);
    v_name  := COALESCE(v_name, NEW.full_name, NEW.full_name_placeholder, 'Anonymous');

    IF v_email IS NULL THEN
      RAISE EXCEPTION
        'sync_employee_from_onboarding: email is required for approved onboarding. user_id=% onboarding_id=%',
        NEW.user_id, NEW.id;
    END IF;

    v_employment_type := lower(replace(COALESCE(NEW.employment_type, 'full-time'), '_', '-'));

    INSERT INTO public.employees (
      user_id, employer_id, email, name, full_name, employee_code, employee_number,
      job_title, department, monthly_salary, employment_type, hire_date,
      kyc_status, status, country, updated_at
    )
    VALUES (
      NEW.user_id, v_live_employer_id, v_email, v_name, v_name,
      NEW.employee_code, NEW.employee_code, NEW.job_title, NEW.department,
      NEW.monthly_salary, v_employment_type, NEW.start_date,
      'approved', 'Active', NEW.country, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      employer_id     = EXCLUDED.employer_id,
      email           = COALESCE(EXCLUDED.email, public.employees.email),
      name            = EXCLUDED.name,
      full_name       = EXCLUDED.full_name,
      employee_code   = EXCLUDED.employee_code,
      employee_number = EXCLUDED.employee_number,
      job_title       = EXCLUDED.job_title,
      department      = EXCLUDED.department,
      monthly_salary  = EXCLUDED.monthly_salary,
      employment_type = EXCLUDED.employment_type,
      hire_date       = EXCLUDED.hire_date,
      kyc_status      = EXCLUDED.kyc_status,
      status          = EXCLUDED.status,
      country         = COALESCE(EXCLUDED.country, public.employees.country),
      updated_at      = NOW();
  END IF;

  RETURN NEW;
END;
$function$;

-- 6. update_ticket_timestamp
CREATE OR REPLACE FUNCTION public.update_ticket_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE public.support_tickets
  SET updated_at = NOW()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$function$;

