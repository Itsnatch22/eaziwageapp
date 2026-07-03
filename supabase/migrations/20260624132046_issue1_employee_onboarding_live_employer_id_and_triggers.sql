
ALTER TABLE employee_onboarding
  ADD COLUMN IF NOT EXISTS live_employer_id uuid REFERENCES employers(id);

-- Backfill via canonical employers.onboarding_id path
UPDATE employee_onboarding eo
SET live_employer_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.onboarding_id = eob.id
WHERE eo.employer_id = eob.id
  AND eo.live_employer_id IS NULL;

-- Fallback: legacy user_id join for any rows the above missed
UPDATE employee_onboarding eo
SET live_employer_id = e.id
FROM employer_onboarding eob
JOIN employers e ON e.user_id = eob.user_id
WHERE eo.employer_id = eob.id
  AND eo.live_employer_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_employee_from_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_email            text;
  v_name             text;
  v_live_employer_id uuid;
  v_employment_type  text;
BEGIN
  IF NEW.status = 'approved' THEN

    -- Fast path: pre-resolved column stamped at approval time
    v_live_employer_id := NEW.live_employer_id;

    -- Fallback 1: canonical onboarding_id back-reference
    IF v_live_employer_id IS NULL THEN
      SELECT e.id INTO v_live_employer_id
      FROM public.employers e
      WHERE e.onboarding_id = NEW.employer_id
      LIMIT 1;
    END IF;

    -- Fallback 2: legacy user_id join (kept for historical rows)
    IF v_live_employer_id IS NULL THEN
      SELECT e.id INTO v_live_employer_id
      FROM public.employer_onboarding eo
      JOIN public.employers e ON e.user_id = eo.user_id
      WHERE eo.id = NEW.employer_id
      LIMIT 1;
    END IF;

    IF v_live_employer_id IS NULL THEN
      RAISE EXCEPTION
        'sync_employee_from_onboarding: no live employer found. employer_onboarding_id=%, employee_user_id=%',
        NEW.employer_id, NEW.user_id;
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
        'sync_employee_from_onboarding: email required. user_id=%, onboarding_id=%',
        NEW.user_id, NEW.id;
    END IF;

    v_employment_type := lower(replace(COALESCE(NEW.employment_type, 'full-time'), '_', '-'));

    INSERT INTO public.employees (
      user_id, employer_id, email, name, full_name, employee_code, employee_number,
      job_title, department, monthly_salary, employment_type, hire_date,
      kyc_status, status, country, updated_at
    ) VALUES (
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

CREATE OR REPLACE FUNCTION public.handle_employer_onboarding_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.employee_onboarding eo
    SET live_employer_id = e.id
    FROM public.employers e
    WHERE e.onboarding_id = NEW.id
      AND eo.employer_id = NEW.id
      AND eo.live_employer_id IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

