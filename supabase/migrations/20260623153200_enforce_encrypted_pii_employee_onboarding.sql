
-- Step 1: Enforce NOT NULL on encrypted columns now that backfill is verified
ALTER TABLE employee_onboarding
  ALTER COLUMN national_id         SET NOT NULL,
  ALTER COLUMN bank_account        SET NOT NULL,
  ALTER COLUMN mobile_money_number SET NOT NULL,
  ALTER COLUMN date_of_birth       SET NOT NULL;

-- Step 2: Drop plaintext staging columns
ALTER TABLE employee_onboarding
  DROP COLUMN IF EXISTS national_id_plaintext,
  DROP COLUMN IF EXISTS bank_account_plaintext,
  DROP COLUMN IF EXISTS mobile_money_number_plaintext,
  DROP COLUMN IF EXISTS tax_id_plaintext,
  DROP COLUMN IF EXISTS date_of_birth_plaintext;

