-- employers.risk_score/risk_rating was only ever set once, at onboarding-approval
-- promotion time, and never updated again — while employer_onboarding.risk_score/
-- risk_rating keeps being the one actually maintained (admin PATCH /api/admin/employers/[id]
-- and the employer_risk_factors trigger both only wrote to employer_onboarding). Any
-- consumer reading employers.risk_score (e.g. the topup-requests page) silently showed
-- a stale/default grade instead of the real one. Fix: sync employers whenever
-- employer_onboarding's risk fields change, and backfill the one employer already
-- diverged (Kampala Freight Logistics Ltd, employers.id 11fef27a-7470-43ca-9a28-e5e57cc09fcc).

-- 1) Backfill existing divergence.
UPDATE public.employers e
SET risk_score = o.risk_score,
    risk_rating = o.risk_rating,
    updated_at = now()
FROM public.employer_onboarding o
WHERE o.user_id = e.user_id
  AND (e.risk_score IS DISTINCT FROM o.risk_score OR e.risk_rating IS DISTINCT FROM o.risk_rating);

-- 2) Trigger to sync employers.risk_score/risk_rating whenever employer_onboarding's
-- own risk fields change (covers the direct admin PATCH path).
CREATE OR REPLACE FUNCTION public.fn_sync_employer_risk_score_to_live()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.risk_score IS DISTINCT FROM OLD.risk_score OR NEW.risk_rating IS DISTINCT FROM OLD.risk_rating THEN
    UPDATE public.employers
    SET risk_score = NEW.risk_score, risk_rating = NEW.risk_rating, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_employer_risk_score_to_live ON public.employer_onboarding;
CREATE TRIGGER trg_sync_employer_risk_score_to_live
AFTER UPDATE ON public.employer_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_employer_risk_score_to_live();

-- 3) fn_sync_employer_risk_score (fired by employer_risk_factors changes) only ever
-- wrote to employer_onboarding; now that employer_onboarding's own AFTER UPDATE
-- trigger (above) propagates to employers, this composite-score path is covered too
-- without needing to touch fn_sync_employer_risk_score itself.
