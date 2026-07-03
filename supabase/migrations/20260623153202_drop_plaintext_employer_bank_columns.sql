
-- Drop plaintext staging columns from employer_onboarding
ALTER TABLE employer_onboarding
  DROP COLUMN IF EXISTS bank_account_number_plaintext;

-- Drop plaintext staging columns from bank_change_requests
ALTER TABLE bank_change_requests
  DROP COLUMN IF EXISTS old_account_number_plaintext,
  DROP COLUMN IF EXISTS new_account_number_plaintext;

