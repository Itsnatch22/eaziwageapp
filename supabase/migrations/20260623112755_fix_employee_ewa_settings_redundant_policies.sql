
-- 2.6: Drop redundant SELECT policy (superseded by employers_can_read_employee_ewa_settings)
DROP POLICY "ewa_settings_employer_select" ON employee_ewa_settings;

-- Also drop redundant ALL policy (superseded by employers_can_manage_employee_ewa_settings
-- which has the same logic plus updated_by check)
DROP POLICY "ewa_settings_employer_upsert" ON employee_ewa_settings;

