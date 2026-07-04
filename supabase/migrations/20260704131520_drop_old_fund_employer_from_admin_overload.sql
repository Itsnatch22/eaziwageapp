-- The prior CREATE OR REPLACE added a new optional trailing parameter, which
-- Postgres treats as a distinct overload rather than replacing the original
-- signature — leaving two versions of fund_employer_from_admin and making any
-- named-parameter call (as both callers use) ambiguous. Drop the old 7-arg
-- signature so only the 8-arg version (with p_existing_wallet_transaction_id) remains.
DROP FUNCTION IF EXISTS public.fund_employer_from_admin(
  uuid, uuid, numeric, numeric, text, uuid, text
);
