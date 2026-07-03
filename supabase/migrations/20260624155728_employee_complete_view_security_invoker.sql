
DROP VIEW IF EXISTS employee_complete_view;

CREATE VIEW employee_complete_view
WITH (security_invoker = true)
AS
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

