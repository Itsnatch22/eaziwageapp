Any flow that creates an employees row must now have the employer in approved or suspended status first — inserts against a pending employer will hard-fail at the DB level. That's the intended behaviour, but worth flagging to whoever writes the employer onboarding completion handler.

# employee_onboarding
Required application-side backfill — run this once with your actual encryption key injected (never commit the key):
sql-- Run via your backend/migration script with $PII_ENCRYPTION_KEY injected from env
UPDATE employee_onboarding SET
  national_id          = pgp_sym_encrypt(national_id_plaintext,          '$PII_ENCRYPTION_KEY'),
  bank_account         = pgp_sym_encrypt(bank_account_plaintext,         '$PII_ENCRYPTION_KEY'),
  mobile_money_number  = pgp_sym_encrypt(mobile_money_number_plaintext,  '$PII_ENCRYPTION_KEY'),
  tax_id               = CASE WHEN tax_id_plaintext IS NOT NULL
                              THEN pgp_sym_encrypt(tax_id_plaintext, '$PII_ENCRYPTION_KEY')
                              ELSE NULL END,
  date_of_birth        = pgp_sym_encrypt(date_of_birth_plaintext::text,  '$PII_ENCRYPTION_KEY');
After backfill is verified, run the cleanup migration:
sql-- Enforce NOT NULL now that encrypted columns are populated
ALTER TABLE employee_onboarding
  ALTER COLUMN national_id         SET NOT NULL,
  ALTER COLUMN bank_account        SET NOT NULL,
  ALTER COLUMN mobile_money_number SET NOT NULL,
  ALTER COLUMN date_of_birth       SET NOT NULL;

-- Drop staging columns
ALTER TABLE employee_onboarding
  DROP COLUMN national_id_plaintext,
  DROP COLUMN bank_account_plaintext,
  DROP COLUMN mobile_money_number_plaintext,
  DROP COLUMN tax_id_plaintext,
  DROP COLUMN date_of_birth_plaintext;
Decryption pattern for your app:
sqlpgp_sym_decrypt(national_id, $PII_ENCRYPTION_KEY)::text
pgp_sym_decrypt(date_of_birth, $PII_ENCRYPTION_KEY)::date
The key itself should live in an environment variable (PII_ENCRYPTION_KEY) accessed by your Edge Functions and backend — never in the DB, never in migration history. When you're ready to wire up the backfill, let me know and I'll help with the Edge Function that executes it securely.

# employer_onboarding
Backfill SQL (inject $PII_ENCRYPTION_KEY from env, never hardcode):
sql-- employer_onboarding
UPDATE employer_onboarding SET
  bank_account_number = pgp_sym_encrypt(bank_account_number_plaintext, '$PII_ENCRYPTION_KEY')
WHERE bank_account_number_plaintext IS NOT NULL;

-- bank_change_requests (zero rows now, but covers future inserts before cleanup)
UPDATE bank_change_requests SET
  old_account_number = CASE WHEN old_account_number_plaintext IS NOT NULL
                            THEN pgp_sym_encrypt(old_account_number_plaintext, '$PII_ENCRYPTION_KEY')
                            ELSE NULL END,
  new_account_number = pgp_sym_encrypt(new_account_number_plaintext, '$PII_ENCRYPTION_KEY');
Cleanup migration (after backfill verified):
sqlALTER TABLE employer_onboarding
  DROP COLUMN bank_account_number_plaintext;

ALTER TABLE bank_change_requests
  DROP COLUMN old_account_number_plaintext,
  DROP COLUMN new_account_number_plaintext;
One thing to flag for your app code: bank_change_requests.new_account_number was NOT NULL — once you drop the plaintext staging column, inserts must supply the encrypted value. Any Edge Function that handles bank change request submissions needs to encrypt before insert using the same $PII_ENCRYPTION_KEY. This is the same key used for 1.3, so a single PII_ENCRYPTION_KEY env var covers all PII encryption across both findings.

# paymemt_method_verifications
anywhere your backend or Edge Functions currently insert into payment_method_verifications or verify an OTP submission, update to:
ts// Insert (generate OTP, store hash only)
const otp = generateOtp()          // your 6-digit generator
const otpHash = createHash('sha256').update(otp).digest('hex')
// insert otp_hash, send raw otp to user via SMS/email, never persist it

// Verify
const submittedHash = createHash('sha256').update(submittedOtp).digest('hex')
// SELECT ... WHERE otp_hash = $submittedHash AND is_used = false AND expires_at > now()

# employees.organization_id
employees.organization_id is also nullable in schema despite all 4 live rows having it set — that's a parallel gap worth tracking as a separate finding. The backfill path from employees to advances only works reliably once employees.organization_id is itself enforced. 

# profile.payment_methods
Remaining manual step — migrate the orphaned JSONB entry:
One profile has a mobile money payment method in JSONB with no normalized row. Before the column can be dropped, run this via your backend with $EMPLOYEE_ID resolved for profile 82cdc658:
sqlINSERT INTO payment_methods (
  id, employee_id, country_code, method_type, provider_name,
  account_name, phone_number, is_default, is_verified, is_active,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  e.id,                          -- employee_id for this profile's user
  'KE',
  entry->>'type',                -- 'mobile_money'
  entry->>'provider',            -- 'M-pesa'
  entry->>'account_name',
  entry->>'account_number',
  (entry->>'is_primary')::boolean,
  false,                         -- unverified until confirmed
  true,
  (entry->>'created_at')::timestamptz,
  now()
FROM profiles p,
     jsonb_array_elements(p.payment_methods) AS entry
JOIN employees e ON e.user_id = p.id
WHERE p.id = '82cdc658-478c-42a7-b300-0fa03754b520'
ON CONFLICT DO NOTHING;
Once verified, the column drop is a single ALTER TABLE profiles DROP COLUMN payment_methods. 

# statements
 statements_admin_select references system_admins table, not profiles.is_admin or current_user_is_admin() like the rest of your admin policies. You've got three different admin resolution patterns in play across your RLS policies. That's going to cause you a headache when an admin exists in one table but not another. Flag that for a future cleanup pass.
