
-- 1. Backfill existing broken rows — employer approved but live_employer_id never stamped
--    because the employers row didn't exist when the approval trigger fired
UPDATE public.employee_onboarding eo
SET live_employer_id = e.id
FROM public.employer_onboarding eob
JOIN public.employers e ON e.onboarding_id = eob.id
WHERE eo.employer_id = eob.id
  AND eo.live_employer_id IS NULL;

-- 2. Trigger function: when an employers row is inserted (or onboarding_id set),
--    backfill any employee_onboarding rows that were waiting for it
CREATE OR REPLACE FUNCTION public.trg_stamp_employee_live_employer_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  IF NEW.onboarding_id IS NOT NULL THEN
    UPDATE public.employee_onboarding eo
    SET live_employer_id = NEW.id
    WHERE eo.employer_id = NEW.onboarding_id
      AND eo.live_employer_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Wire the trigger — fires after INSERT and after UPDATE when onboarding_id changes
DROP TRIGGER IF EXISTS trg_employers_stamp_live_employer_id ON public.employers;
CREATE TRIGGER trg_employers_stamp_live_employer_id
  AFTER INSERT OR UPDATE OF onboarding_id ON public.employers
  FOR EACH ROW EXECUTE FUNCTION public.trg_stamp_employee_live_employer_id();

