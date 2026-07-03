
-- Issue 2: both rows already have employer_live_id populated — enforce it.
ALTER TABLE employee_ewa_settings ALTER COLUMN employer_live_id SET NOT NULL;

