
-- ============================================================
-- PII Encryption: employee_onboarding
-- Strategy: rename plaintext columns → _plaintext (temporary
-- staging), add encrypted bytea columns. Application layer
-- must run the backfill using pgp_sym_encrypt(value, $KEY)
-- before the _plaintext columns are dropped.
-- Affected: national_id, bank_account, mobile_money_number,
--           tax_id, date_of_birth
-- ============================================================

-- Step 1: Rename plaintext columns to staging names
ALTER TABLE employee_onboarding
  RENAME COLUMN national_id TO national_id_plaintext;

ALTER TABLE employee_onboarding
  RENAME COLUMN bank_account TO bank_account_plaintext;

ALTER TABLE employee_onboarding
  RENAME COLUMN mobile_money_number TO mobile_money_number_plaintext;

ALTER TABLE employee_onboarding
  RENAME COLUMN tax_id TO tax_id_plaintext;

ALTER TABLE employee_onboarding
  RENAME COLUMN date_of_birth TO date_of_birth_plaintext;

-- Step 2: Add encrypted bytea columns
-- national_id: was NOT NULL — keep NOT NULL after backfill; nullable now during transition
ALTER TABLE employee_onboarding
  ADD COLUMN national_id bytea;

-- bank_account: was NOT NULL
ALTER TABLE employee_onboarding
  ADD COLUMN bank_account bytea;

-- mobile_money_number: was NOT NULL
ALTER TABLE employee_onboarding
  ADD COLUMN mobile_money_number bytea;

-- tax_id: was nullable
ALTER TABLE employee_onboarding
  ADD COLUMN tax_id bytea;

-- date_of_birth: was NOT NULL date type
ALTER TABLE employee_onboarding
  ADD COLUMN date_of_birth bytea;

-- Step 3: Column comments documenting encryption scheme and pending backfill
COMMENT ON COLUMN employee_onboarding.national_id IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto). 
   Decrypt with: pgp_sym_decrypt(national_id, $KEY)::text. 
   BACKFILL PENDING — national_id_plaintext staging column contains cleartext until backfill completes.';

COMMENT ON COLUMN employee_onboarding.bank_account IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto). 
   Decrypt with: pgp_sym_decrypt(bank_account, $KEY)::text. 
   BACKFILL PENDING — bank_account_plaintext staging column contains cleartext until backfill completes.';

COMMENT ON COLUMN employee_onboarding.mobile_money_number IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto). 
   Decrypt with: pgp_sym_decrypt(mobile_money_number, $KEY)::text. 
   BACKFILL PENDING — mobile_money_number_plaintext staging column contains cleartext until backfill completes.';

COMMENT ON COLUMN employee_onboarding.tax_id IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto). Nullable. 
   Decrypt with: pgp_sym_decrypt(tax_id, $KEY)::text. 
   BACKFILL PENDING — tax_id_plaintext staging column contains cleartext until backfill completes.';

COMMENT ON COLUMN employee_onboarding.date_of_birth IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto). Originally date type. 
   Decrypt with: pgp_sym_decrypt(date_of_birth, $KEY)::date. 
   BACKFILL PENDING — date_of_birth_plaintext staging column contains cleartext until backfill completes.';

