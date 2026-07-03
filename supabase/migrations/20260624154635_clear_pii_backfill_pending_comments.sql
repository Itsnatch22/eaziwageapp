
COMMENT ON COLUMN employee_onboarding.national_id IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto).
   Decrypt with: pgp_sym_decrypt(national_id, $KEY)::text.
   Write via: upsert_employee_onboarding_pii() RPC.';

COMMENT ON COLUMN employee_onboarding.bank_account IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto).
   Decrypt with: pgp_sym_decrypt(bank_account, $KEY)::text.
   Write via: upsert_employee_onboarding_pii() RPC.';

COMMENT ON COLUMN employee_onboarding.mobile_money_number IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto).
   Decrypt with: pgp_sym_decrypt(mobile_money_number, $KEY)::text.
   Write via: upsert_employee_onboarding_pii() RPC.';

COMMENT ON COLUMN employee_onboarding.date_of_birth IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto).
   Decrypt with: pgp_sym_decrypt(date_of_birth, $KEY)::date.
   Write via: upsert_employee_onboarding_pii() RPC.';

COMMENT ON COLUMN employee_onboarding.tax_id IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto). Nullable.
   Decrypt with: pgp_sym_decrypt(tax_id, $KEY)::text.
   Write via: upsert_employee_onboarding_pii() RPC.';

COMMENT ON COLUMN employer_onboarding.bank_account_number IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto).
   Decrypt with: pgp_sym_decrypt(bank_account_number, $KEY)::text.
   Write via: upsert_employer_onboarding_pii() RPC.';

COMMENT ON COLUMN bank_change_requests.old_account_number IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto).
   Decrypt with: pgp_sym_decrypt(old_account_number, $KEY)::text.
   Write via: insert_bank_change_request_pii() RPC.';

COMMENT ON COLUMN bank_change_requests.new_account_number IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto).
   Decrypt with: pgp_sym_decrypt(new_account_number, $KEY)::text.
   Write via: insert_bank_change_request_pii() RPC.';

