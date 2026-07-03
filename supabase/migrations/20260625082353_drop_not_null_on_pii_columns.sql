
ALTER TABLE employee_onboarding
  ALTER COLUMN national_id         DROP NOT NULL,
  ALTER COLUMN bank_account        DROP NOT NULL,
  ALTER COLUMN mobile_money_number DROP NOT NULL,
  ALTER COLUMN date_of_birth       DROP NOT NULL;

