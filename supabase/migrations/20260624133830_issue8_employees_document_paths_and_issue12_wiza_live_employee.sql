
-- Issue 8 (Option A): add _path columns to employees
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS id_document_front_path   text,
  ADD COLUMN IF NOT EXISTS id_document_back_path    text,
  ADD COLUMN IF NOT EXISTS address_proof_path       text,
  ADD COLUMN IF NOT EXISTS bank_statement_path      text,
  ADD COLUMN IF NOT EXISTS employment_contract_path text,
  ADD COLUMN IF NOT EXISTS payslip_1_path           text,
  ADD COLUMN IF NOT EXISTS payslip_2_path           text,
  ADD COLUMN IF NOT EXISTS selfie_path              text;

-- Issue 12: add live employee FK to wiza_sessions
ALTER TABLE wiza_sessions
  ADD COLUMN IF NOT EXISTS employee_live_id uuid REFERENCES employees(id);

-- Backfill employees path columns from approved employee_onboarding rows
-- (employee_onboarding uses id_front/id_back; employees uses id_document_front/back booleans)
UPDATE employees emp
SET
  id_document_front_path   = eo.id_front,
  id_document_back_path    = eo.id_back,
  address_proof_path       = eo.address_proof,
  bank_statement_path      = eo.bank_statement,
  employment_contract_path = eo.employment_contract,
  payslip_1_path           = eo.payslip_1,
  payslip_2_path           = eo.payslip_2
FROM employee_onboarding eo
WHERE eo.user_id = emp.user_id
  AND eo.status = 'approved'
  AND emp.id_document_front_path IS NULL;

-- Backfill wiza_sessions.employee_live_id (currently 0 rows — future-proofs new sessions)
UPDATE wiza_sessions ws
SET employee_live_id = emp.id
FROM employee_onboarding eo
JOIN employees emp ON emp.user_id = eo.user_id
WHERE ws.employee_id = eo.id
  AND ws.employee_live_id IS NULL;

-- Update sync_employee_from_onboarding to carry document paths into employees
-- and stamp employee_live_id on any wiza_sessions for the onboarding record.
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
  v_employee_id      uuid;
BEGIN
  IF NEW.status = 'approved' THEN

    -- Fast path: pre-resolved live_employer_id column
    v_live_employer_id := NEW.live_employer_id;

    -- Fallback 1: canonical onboarding_id back-reference
    IF v_live_employer_id IS NULL THEN
      SELECT e.id INTO v_live_employer_id
      FROM public.employers e
      WHERE e.onboarding_id = NEW.employer_id
      LIMIT 1;
    END IF;

    -- Fallback 2: legacy user_id join
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
      kyc_status, status, country,
      id_document_front_path, id_document_back_path, address_proof_path,
      bank_statement_path, employment_contract_path, payslip_1_path, payslip_2_path,
      updated_at
    ) VALUES (
      NEW.user_id, v_live_employer_id, v_email, v_name, v_name,
      NEW.employee_code, NEW.employee_code, NEW.job_title, NEW.department,
      NEW.monthly_salary, v_employment_type, NEW.start_date,
      'approved', 'Active', NEW.country,
      NEW.id_front, NEW.id_back, NEW.address_proof,
      NEW.bank_statement, NEW.employment_contract, NEW.payslip_1, NEW.payslip_2,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      employer_id              = EXCLUDED.employer_id,
      email                    = COALESCE(EXCLUDED.email, public.employees.email),
      name                     = EXCLUDED.name,
      full_name                = EXCLUDED.full_name,
      employee_code            = EXCLUDED.employee_code,
      employee_number          = EXCLUDED.employee_number,
      job_title                = EXCLUDED.job_title,
      department               = EXCLUDED.department,
      monthly_salary           = EXCLUDED.monthly_salary,
      employment_type          = EXCLUDED.employment_type,
      hire_date                = EXCLUDED.hire_date,
      kyc_status               = EXCLUDED.kyc_status,
      status                   = EXCLUDED.status,
      country                  = COALESCE(EXCLUDED.country, public.employees.country),
      id_document_front_path   = COALESCE(EXCLUDED.id_document_front_path,   public.employees.id_document_front_path),
      id_document_back_path    = COALESCE(EXCLUDED.id_document_back_path,    public.employees.id_document_back_path),
      address_proof_path       = COALESCE(EXCLUDED.address_proof_path,       public.employees.address_proof_path),
      bank_statement_path      = COALESCE(EXCLUDED.bank_statement_path,      public.employees.bank_statement_path),
      employment_contract_path = COALESCE(EXCLUDED.employment_contract_path, public.employees.employment_contract_path),
      payslip_1_path           = COALESCE(EXCLUDED.payslip_1_path,           public.employees.payslip_1_path),
      payslip_2_path           = COALESCE(EXCLUDED.payslip_2_path,           public.employees.payslip_2_path),
      updated_at               = NOW()
    RETURNING id INTO v_employee_id;

    -- Issue 12: stamp employee_live_id on all wiza_sessions for this onboarding record
    IF v_employee_id IS NOT NULL THEN
      UPDATE public.wiza_sessions
      SET employee_live_id = v_employee_id
      WHERE employee_id = NEW.id
        AND employee_live_id IS NULL;
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

