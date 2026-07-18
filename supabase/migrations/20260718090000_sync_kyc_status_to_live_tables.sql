-- Separates "account approval" (dashboard access — employees.status /
-- employers.status, admin-controlled) from "KYC approval" (money-movement
-- eligibility — employees.kyc_status / employers.is_verified).
--
-- Root cause: sync_employee_from_onboarding() and
-- handle_employer_onboarding_approval() only fire their promotion logic
-- IF NEW.status = 'approved' — there was no symmetric path to demote
-- employees.kyc_status / employers.is_verified when a later document
-- rejection recomputes employee_onboarding.status / employer_onboarding.status
-- back down. Result: once an account was promoted, a subsequent KYC document
-- rejection (recompute_employee_onboarding_status /
-- recompute_employer_onboarding_status already correctly flip the onboarding
-- rollup status) never propagated anywhere money-movement eligibility checks
-- actually look — lib/services/payout-service.ts's checkEmployeeEligibility()
-- reads employees.kyc_status, and app/api/employee-dashboard/request-advance
-- reads employers.status — both stayed stuck at their promotion-time values
-- forever. These triggers close that gap by keeping kyc_status/is_verified
-- continuously synced to the onboarding rollup, in both directions, without
-- touching employees.status/employers.status (the admin-controlled account
-- flags) at all — so a KYC rejection blocks money movement without also
-- revoking dashboard access.

CREATE OR REPLACE FUNCTION public.fn_sync_employee_kyc_to_live()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_kyc_status text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- 'suspended' is an admin hold, not a KYC-derived state — leave
    -- employees.kyc_status untouched, mirroring
    -- recompute_employee_onboarding_status()'s own carve-out for it.
    IF NEW.status = 'suspended' THEN
      RETURN NEW;
    END IF;

    v_kyc_status := CASE NEW.status
      WHEN 'approved'      THEN 'approved'
      WHEN 'rejected'      THEN 'rejected'
      WHEN 'under_review'  THEN 'submitted'
      ELSE 'pending'
    END;

    UPDATE public.employees
    SET kyc_status = v_kyc_status, updated_at = now()
    WHERE user_id = NEW.user_id AND kyc_status IS DISTINCT FROM v_kyc_status;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_employee_kyc_to_live ON public.employee_onboarding;
CREATE TRIGGER trg_sync_employee_kyc_to_live
AFTER UPDATE ON public.employee_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_employee_kyc_to_live();

CREATE OR REPLACE FUNCTION public.fn_sync_employer_kyc_to_live()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_verified boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- 'suspended'/'risk_review_in_progress' are admin holds, not KYC-derived
    -- states — leave employers.is_verified untouched, mirroring
    -- recompute_employer_onboarding_status()'s own carve-outs for them.
    IF NEW.status IN ('suspended', 'risk_review_in_progress') THEN
      RETURN NEW;
    END IF;

    v_is_verified := (NEW.status = 'approved');

    UPDATE public.employers
    SET is_verified = v_is_verified, updated_at = now()
    WHERE user_id = NEW.user_id AND is_verified IS DISTINCT FROM v_is_verified;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_employer_kyc_to_live ON public.employer_onboarding;
CREATE TRIGGER trg_sync_employer_kyc_to_live
AFTER UPDATE ON public.employer_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_employer_kyc_to_live();
