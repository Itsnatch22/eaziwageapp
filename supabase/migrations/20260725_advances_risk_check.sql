-- Migration: Reject advances for employees rated 'D' and auto-fill fee_percentage
-- Date: 2026-07-25

-- Create function to check employee risk rating and fill fee
CREATE OR REPLACE FUNCTION public.trg_advances_check_risk_fill_fee()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  emp_row RECORD;
BEGIN
  -- If no employee linked, nothing to do
  IF NEW.employee_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT risk_rating, application_fee_percent INTO emp_row
  FROM public.employees
  WHERE id = NEW.employee_id;

  -- If employee not found or no score yet, allow (do nothing)
  IF emp_row IS NULL THEN
    RETURN NEW;
  END IF;

  -- If employee is rated D, reject the insert with a clear error
  IF emp_row.risk_rating = 'D' THEN
    RAISE EXCEPTION 'Advance rejected: employee % is rated D (Very High Risk) and cannot request advances', NEW.employee_id;
  END IF;

  -- Auto-fill fee_percentage when application has not provided one and the employee row has an application_fee_percent
  IF (NEW.fee_percentage IS NULL OR NEW.fee_percentage = 0) AND emp_row.application_fee_percent IS NOT NULL THEN
    NEW.fee_percentage := emp_row.application_fee_percent;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on advances before INSERT
DROP TRIGGER IF EXISTS trg_advances_before_insert ON public.advances;
CREATE TRIGGER trg_advances_before_insert
BEFORE INSERT ON public.advances
FOR EACH ROW
EXECUTE FUNCTION public.trg_advances_check_risk_fill_fee();

-- (Optional) also apply the check on UPDATE when employee_id or fee_percentage changes
DROP TRIGGER IF EXISTS trg_advances_before_update ON public.advances;
CREATE TRIGGER trg_advances_before_update
BEFORE UPDATE ON public.advances
FOR EACH ROW
WHEN (OLD.employee_id IS DISTINCT FROM NEW.employee_id OR OLD.fee_percentage IS DISTINCT FROM NEW.fee_percentage)
EXECUTE FUNCTION public.trg_advances_check_risk_fill_fee();
