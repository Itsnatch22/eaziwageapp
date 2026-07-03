
-- Add unique constraint on employee_id so upsert works correctly
ALTER TABLE public.employee_ewa_settings
  ADD CONSTRAINT employee_ewa_settings_employee_id_key UNIQUE (employee_id);

