
-- Add bank account columns to employers live table
ALTER TABLE employers
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_number bytea; -- PGP encrypted, same as employer_onboarding

-- RPC to promote bank account from onboarding to employers
-- Called during approval route after employers row is created
CREATE OR REPLACE FUNCTION promote_employer_bank_account(
  p_onboarding_id uuid,
  p_employer_id uuid,
  p_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_name text;
  v_bank_account_number bytea;
BEGIN
  -- Read from onboarding (encrypted)
  SELECT 
    bank_name,
    bank_account_number
  INTO v_bank_name, v_bank_account_number
  FROM public.employer_onboarding
  WHERE id = p_onboarding_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'employer_onboarding not found for id: %', p_onboarding_id;
  END IF;

  IF v_bank_account_number IS NULL THEN
    RAISE EXCEPTION 'No bank account on onboarding record: %', p_onboarding_id;
  END IF;

  -- Write to employers (re-encrypt with same key — bytea copy is safe)
  UPDATE public.employers
  SET
    bank_name = v_bank_name,
    bank_account_number = v_bank_account_number,
    updated_at = NOW()
  WHERE id = p_employer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'employers row not found for id: %', p_employer_id;
  END IF;
END;
$$;

-- Only service role can call this — never anon
REVOKE EXECUTE ON FUNCTION promote_employer_bank_account(uuid, uuid, text) FROM anon, authenticated;

