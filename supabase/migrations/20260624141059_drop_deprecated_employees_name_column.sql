
-- 1. Drop the sync trigger and function
DROP TRIGGER IF EXISTS trg_sync_employee_name ON employees;
DROP FUNCTION IF EXISTS sync_employee_name_from_full_name();

-- 2. Drop the dependent view (will recreate cleanly below)
DROP VIEW IF EXISTS employee_complete_view;

-- 3. Drop the deprecated column
ALTER TABLE employees DROP COLUMN IF EXISTS name;

-- 4. Recreate the view using full_name only
CREATE VIEW employee_complete_view AS
SELECT
  e.id,
  e.user_id,
  e.employer_id,
  e.employee_code,
  e.full_name AS display_name,
  e.email,
  e.job_title,
  e.department,
  e.monthly_salary,
  e.employment_type,
  e.status,
  e.kyc_status,
  e.hire_date,
  p.company_name,
  eo.start_date AS onboarding_start_date,
  eo.currency,
  p.full_name AS profile_full_name,
  p.avatar_url,
  e.created_at,
  e.updated_at
FROM employees e
LEFT JOIN employee_onboarding eo ON e.user_id = eo.user_id
LEFT JOIN profiles p ON e.user_id = p.id;

