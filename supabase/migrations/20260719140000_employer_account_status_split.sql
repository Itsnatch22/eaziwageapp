-- Splits the admin's account-approval decision out of employer_onboarding.status,
-- which today serves two conflated purposes: (1) a pure KYC-document-review
-- rollup, derived by recompute_employer_onboarding_status() from document
-- counts, and (2) admin holds ('suspended'/'risk_review_in_progress'),
-- written directly by app/api/admin/employers/[id]/status/route.ts. That
-- route also promoted an employer to the live `employers` table (granting
-- real dashboard login) only once the KYC rollup independently reached
-- 'approved' — meaning KYC document completion silently granted account
-- access, and conversely the "Approve account" button had to bulk-force-
-- approve every document just to flip the rollup and unlock promotion.
--
-- New column `account_status` becomes the ONLY place an admin's explicit
-- account decision lives (pending/approved/rejected/suspended/
-- risk_review_in_progress), written exclusively by the account-status route.
-- `status` becomes PURELY the KYC-document rollup going forward (draft/
-- submitted/pending/under_review/approved/rejected — never a hold state).

ALTER TABLE public.employer_onboarding
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending'
  CHECK (account_status IN ('pending', 'approved', 'rejected', 'suspended', 'risk_review_in_progress'));

COMMENT ON COLUMN public.employer_onboarding.account_status IS
  'Admin''s explicit account-approval decision (dashboard-access gate), independent of status (pure KYC-document rollup). Written only by app/api/admin/employers/[id]/status/route.ts — never by any trigger.';

COMMENT ON COLUMN public.employer_onboarding.status IS
  'Pure KYC-document application/review lifecycle (draft/submitted/pending/under_review/approved/rejected) — derived by recompute_employer_onboarding_status() once documents exist. Never holds suspended/risk_review_in_progress; see account_status for admin holds.';

-- Backfill: a promoted employers row is proof an admin previously approved
-- the account; otherwise inherit whatever hold state is currently sitting in
-- status (the only place it could have lived until now).
UPDATE public.employer_onboarding eo
SET account_status = CASE
  WHEN EXISTS (SELECT 1 FROM public.employers e WHERE e.user_id = eo.user_id) THEN 'approved'
  WHEN eo.status IN ('suspended', 'risk_review_in_progress') THEN eo.status
  ELSE 'pending'
END;

-- Reset `status` for any row currently frozen at suspended/risk_review_in_progress
-- back to its true KYC-document-derived value — recomputed once here with the
-- same logic recompute_employer_onboarding_status() uses, since that
-- function's own skip-guard (removed below) is what froze these.
WITH kyc_counts AS (
  SELECT
    eo.user_id,
    count(*) FILTER (WHERE d.document_type IN (
      'certificate_of_incorporation', 'business_registration', 'tax_compliance_certificate',
      'cr12_document', 'kra_pin_certificate', 'business_permit', 'audited_financials',
      'bank_statement', 'proof_of_address', 'proof_of_bank_account', 'employment_contract_template'
    )) AS submitted_count,
    count(*) FILTER (WHERE d.status = 'rejected') AS rejected_count,
    count(*) FILTER (WHERE d.status = 'approved') AS approved_count
  FROM public.employer_onboarding eo
  LEFT JOIN public.employer_kyc_documents d ON d.user_id = eo.user_id
  WHERE eo.status IN ('suspended', 'risk_review_in_progress')
  GROUP BY eo.user_id
)
UPDATE public.employer_onboarding eo
SET status = CASE
  WHEN kc.rejected_count > 0 THEN 'rejected'
  WHEN kc.submitted_count < 11 THEN 'pending'
  WHEN kc.approved_count = 11 THEN 'approved'
  ELSE 'under_review'
END
FROM kyc_counts kc
WHERE eo.user_id = kc.user_id;

-- status is now purely KYC-derived — always safe to recompute regardless of
-- account_status, so the suspended/risk_review_in_progress skip-guard is
-- removed (those values can no longer appear in status at all).
CREATE OR REPLACE FUNCTION public.recompute_employer_onboarding_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_user_id uuid;
  v_submitted_count int;
  v_rejected_count int;
  v_approved_count int;
  v_required_count int := 11;
  v_new_status text;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF NOT EXISTS (SELECT 1 FROM public.employer_onboarding WHERE user_id = v_user_id) THEN
    RETURN NEW;
  END IF;

  SELECT
    count(*) FILTER (WHERE document_type IN (
      'certificate_of_incorporation', 'business_registration', 'tax_compliance_certificate',
      'cr12_document', 'kra_pin_certificate', 'business_permit', 'audited_financials',
      'bank_statement', 'proof_of_address', 'proof_of_bank_account', 'employment_contract_template'
    )),
    count(*) FILTER (WHERE status = 'rejected'),
    count(*) FILTER (WHERE status = 'approved')
  INTO v_submitted_count, v_rejected_count, v_approved_count
  FROM public.employer_kyc_documents
  WHERE user_id = v_user_id;

  IF v_rejected_count > 0 THEN
    v_new_status := 'rejected';
  ELSIF v_submitted_count < v_required_count THEN
    v_new_status := 'pending';
  ELSIF v_approved_count = v_required_count THEN
    v_new_status := 'approved';
  ELSE
    v_new_status := 'under_review';
  END IF;

  UPDATE public.employer_onboarding
  SET status = v_new_status, updated_at = now()
  WHERE user_id = v_user_id AND status IS DISTINCT FROM v_new_status;

  RETURN NEW;
END;
$function$;

-- status can no longer hold suspended/risk_review_in_progress, so the early
-- exit for those is dead code — removed. is_verified stays purely a function
-- of the KYC rollup, exactly as before.
CREATE OR REPLACE FUNCTION public.fn_sync_employer_kyc_to_live()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_is_verified boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_is_verified := (NEW.status = 'approved');

    UPDATE public.employers
    SET is_verified = v_is_verified, updated_at = now()
    WHERE user_id = NEW.user_id AND is_verified IS DISTINCT FROM v_is_verified;
  END IF;
  RETURN NEW;
END;
$function$;

-- The account-approval decision now lives in account_status, not status —
-- re-point the live_employer_id linkage trigger accordingly so it fires at
-- the moment the admin actually approves the account (the new promotion
-- trigger), not whenever the KYC rollup happens to reach 'approved'.
CREATE OR REPLACE FUNCTION public.handle_employer_onboarding_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.account_status = 'approved' AND (OLD.account_status IS DISTINCT FROM 'approved') THEN
    UPDATE public.employee_onboarding eo
    SET live_employer_id = e.id
    FROM public.employers e
    WHERE e.onboarding_id = NEW.id
      AND eo.employer_id = NEW.id
      AND eo.live_employer_id IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;
