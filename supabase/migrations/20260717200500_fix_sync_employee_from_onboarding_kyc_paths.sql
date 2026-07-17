-- Fix sync_employee_from_onboarding(): it referenced NEW.id_front, NEW.id_back,
-- NEW.address_proof, NEW.bank_statement, NEW.employment_contract, NEW.payslip_1,
-- NEW.payslip_2 as if they were columns on employee_onboarding. They never
-- were -- KYC document URLs live in employee_kyc_documents (one row per
-- document_type), a schema employee_onboarding moved to at some point after
-- this function was written. Every approval of an employee whose KYC docs
-- were all approved crashed this AFTER UPDATE trigger with
-- "record 'new' has no field 'id_front'", 500ing the admin approve route.
--
-- Fix: look up each path from employee_kyc_documents.document_url by
-- (user_id, document_type) instead of NEW.<column>.

CREATE OR REPLACE FUNCTION public.sync_employee_from_onboarding()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_email            text;
  v_name             text;
  v_live_employer_id uuid;
  v_employment_type  text;
  v_employee_id      uuid;
  v_id_front         text;
  v_id_back          text;
  v_address_proof    text;
  v_bank_statement   text;
  v_employment_contract text;
  v_payslip_1        text;
  v_payslip_2        text;
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

    SELECT document_url INTO v_id_front FROM public.employee_kyc_documents WHERE user_id = NEW.user_id AND document_type = 'id_front' LIMIT 1;
    SELECT document_url INTO v_id_back FROM public.employee_kyc_documents WHERE user_id = NEW.user_id AND document_type = 'id_back' LIMIT 1;
    SELECT document_url INTO v_address_proof FROM public.employee_kyc_documents WHERE user_id = NEW.user_id AND document_type = 'address_proof' LIMIT 1;
    SELECT document_url INTO v_bank_statement FROM public.employee_kyc_documents WHERE user_id = NEW.user_id AND document_type = 'bank_statement' LIMIT 1;
    SELECT document_url INTO v_employment_contract FROM public.employee_kyc_documents WHERE user_id = NEW.user_id AND document_type = 'employment_contract' LIMIT 1;
    SELECT document_url INTO v_payslip_1 FROM public.employee_kyc_documents WHERE user_id = NEW.user_id AND document_type = 'payslip_1' LIMIT 1;
    SELECT document_url INTO v_payslip_2 FROM public.employee_kyc_documents WHERE user_id = NEW.user_id AND document_type = 'payslip_2' LIMIT 1;

    INSERT INTO public.employees (
      user_id, employer_id, email, full_name, employee_code, employee_number,
      job_title, department, monthly_salary, employment_type, hire_date,
      kyc_status, status, country,
      id_document_front_path, id_document_back_path, address_proof_path,
      bank_statement_path, employment_contract_path, payslip_1_path, payslip_2_path,
      updated_at
    ) VALUES (
      NEW.user_id, v_live_employer_id, v_email, v_name,
      NEW.employee_code, NEW.employee_code, NEW.job_title, NEW.department,
      NEW.monthly_salary, v_employment_type, NEW.start_date,
      'approved', 'Active', NEW.country,
      v_id_front, v_id_back, v_address_proof,
      v_bank_statement, v_employment_contract, v_payslip_1, v_payslip_2,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      employer_id              = EXCLUDED.employer_id,
      email                    = COALESCE(EXCLUDED.email, public.employees.email),
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

    -- Stamp employee_live_id on all wiza_sessions for this onboarding record
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
