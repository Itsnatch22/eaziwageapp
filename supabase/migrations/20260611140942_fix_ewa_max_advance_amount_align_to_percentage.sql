
update employee_ewa_settings ees
set 
  max_advance_amount = round((eo.monthly_salary * ees.max_advance_percentage) / 100, 2),
  updated_at = now()
from employee_onboarding eo
where eo.id = ees.employee_onboarding_id
  and ees.max_advance_amount != round((eo.monthly_salary * ees.max_advance_percentage) / 100, 2);

