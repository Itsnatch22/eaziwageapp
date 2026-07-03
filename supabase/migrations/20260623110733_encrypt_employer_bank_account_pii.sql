
-- ============================================================
-- PII Encryption: employer bank account data
-- Tables: employer_onboarding (bank_account_number)
--         bank_change_requests (old_account_number, new_account_number)
-- Strategy: rename plaintext → _plaintext staging, add bytea
-- encrypted columns. Application-side backfill required before
-- _plaintext columns are dropped.
-- ============================================================

-- ── employer_onboarding ──────────────────────────────────────
ALTER TABLE employer_onboarding
  RENAME COLUMN bank_account_number TO bank_account_number_plaintext;

ALTER TABLE employer_onboarding
  ADD COLUMN bank_account_number bytea;

COMMENT ON COLUMN employer_onboarding.bank_account_number IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto).
   Decrypt with: pgp_sym_decrypt(bank_account_number, $KEY)::text.
   BACKFILL PENDING — bank_account_number_plaintext contains cleartext until backfill completes.';

-- ── bank_change_requests ─────────────────────────────────────
ALTER TABLE bank_change_requests
  RENAME COLUMN old_account_number TO old_account_number_plaintext;

ALTER TABLE bank_change_requests
  RENAME COLUMN new_account_number TO new_account_number_plaintext;

ALTER TABLE bank_change_requests
  ADD COLUMN old_account_number bytea;

ALTER TABLE bank_change_requests
  ADD COLUMN new_account_number bytea;

COMMENT ON COLUMN bank_change_requests.old_account_number IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto).
   Decrypt with: pgp_sym_decrypt(old_account_number, $KEY)::text.
   BACKFILL PENDING — old_account_number_plaintext contains cleartext until backfill completes.';

COMMENT ON COLUMN bank_change_requests.new_account_number IS
  'AES-256 encrypted via pgp_sym_encrypt (pgcrypto).
   Decrypt with: pgp_sym_decrypt(new_account_number, $KEY)::text.
   BACKFILL PENDING — new_account_number_plaintext contains cleartext until backfill completes.';

