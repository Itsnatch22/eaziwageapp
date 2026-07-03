
-- Step 1: Drop the GIN index — no query benefit for 1 populated row,
-- and actively misleads developers into treating this as a live data source
DROP INDEX IF EXISTS idx_profiles_payment_methods;

-- Step 2: Mark the column as deprecated with full migration guidance
COMMENT ON COLUMN profiles.payment_methods IS
  'DEPRECATED. Do not read or write this column in new code.
   Payment methods are canonically stored in the payment_methods table (keyed by employee_id).
   
   Migration status: 1 profile (id: 82cdc658-478c-42a7-b300-0fa03754b520) has JSONB data 
   with no corresponding normalized row — must be migrated to payment_methods before this 
   column can be dropped.
   
   Migration path:
     1. For each non-empty entry in this column, INSERT a row into payment_methods
        mapping the JSONB fields to: method_type, provider_name, account_name, 
        account_number/phone_number, is_default (from is_primary), is_verified=false.
     2. Verify all entries have normalized rows.
     3. Run: ALTER TABLE profiles DROP COLUMN payment_methods;
   
   Column retained temporarily for data safety only.';

