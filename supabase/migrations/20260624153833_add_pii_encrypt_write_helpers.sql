
-- ── Employee onboarding: encrypt and upsert all PII fields ──────────────
CREATE OR REPLACE FUNCTION public.upsert_employee_onboarding_pii(
  p_user_id            uuid,
  p_national_id        text,
  p_bank_account       text,
  p_mobile_money       text,
  p_date_of_birth      text,
  p_tax_id             text,  -- nullable
  p_key                text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE employee_onboarding SET
    national_id          = pgp_sym_encrypt(p_national_id,   p_key),
    bank_account         = pgp_sym_encrypt(p_bank_account,  p_key),
    mobile_money_number  = pgp_sym_encrypt(p_mobile_money,  p_key),
    date_of_birth        = pgp_sym_encrypt(p_date_of_birth, p_key),
    tax_id               = CASE
                             WHEN p_tax_id IS NOT NULL
                             THEN pgp_sym_encrypt(p_tax_id, p_key)
                             ELSE NULL
                           END
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'employee_onboarding row not found for user_id %', p_user_id;
  END IF;
END;
$$;

-- ── Employer onboarding: encrypt bank account number ────────────────────
CREATE OR REPLACE FUNCTION public.upsert_employer_onboarding_pii(
  p_onboarding_id      uuid,
  p_bank_account_number text,
  p_key                text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE employer_onboarding SET
    bank_account_number = pgp_sym_encrypt(p_bank_account_number, p_key)
  WHERE id = p_onboarding_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'employer_onboarding row not found for id %', p_onboarding_id;
  END IF;
END;
$$;

-- ── Bank change requests: encrypt both account numbers ───────────────────
CREATE OR REPLACE FUNCTION public.insert_bank_change_request_pii(
  p_employer_id        uuid,
  p_user_id            uuid,
  p_old_bank_name      text,
  p_new_bank_name      text,
  p_old_account_number text,
  p_new_account_number text,
  p_reason             text,
  p_key                text,
  p_employer_live_id   uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO bank_change_requests (
    employer_id,
    user_id,
    old_bank_name,
    new_bank_name,
    old_account_number,
    new_account_number,
    reason,
    employer_live_id
  ) VALUES (
    p_employer_id,
    p_user_id,
    p_old_bank_name,
    p_new_bank_name,
    pgp_sym_encrypt(p_old_account_number, p_key),
    pgp_sym_encrypt(p_new_account_number, p_key),
    p_reason,
    p_employer_live_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── Revoke public/anon access — admin & service role only ────────────────
REVOKE ALL ON FUNCTION public.upsert_employee_onboarding_pii FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_employer_onboarding_pii FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_bank_change_request_pii FROM PUBLIC, anon;

