
-- ============================================================
-- OTP Hashing: payment_method_verifications
-- Replace plaintext otp column with otp_hash (SHA-256 hex),
-- matching the pattern used by email_verifications.token_hash
-- and password_resets.token_hash.
-- All 3 existing rows are expired or used — safe to hash in place.
-- ============================================================

-- Step 1: Add otp_hash column (nullable during transition)
ALTER TABLE payment_method_verifications
  ADD COLUMN otp_hash text;

-- Step 2: Backfill — hash all existing plaintext OTPs immediately
UPDATE payment_method_verifications
  SET otp_hash = encode(digest(otp, 'sha256'), 'hex');

-- Step 3: Enforce NOT NULL now that backfill is complete
ALTER TABLE payment_method_verifications
  ALTER COLUMN otp_hash SET NOT NULL;

-- Step 4: Drop the plaintext column
ALTER TABLE payment_method_verifications
  DROP COLUMN otp;

-- Step 5: Document the column
COMMENT ON COLUMN payment_method_verifications.otp_hash IS
  'SHA-256 hex hash of the OTP. Never store or log the raw OTP.
   Verify with: otp_hash = encode(digest($submitted_otp, ''sha256''), ''hex'').
   Matches the token_hash pattern used by email_verifications and password_resets.';

