
-- ============================================================
-- FIX 1: advances.employee_id — add missing FK to employees
-- ============================================================
ALTER TABLE public.advances
  ADD CONSTRAINT advances_employee_id_fkey
  FOREIGN KEY (employee_id)
  REFERENCES public.employees(id)
  ON DELETE RESTRICT;

-- ============================================================
-- FIX 2: advances.fee_amount — migrate text → numeric
-- ============================================================
ALTER TABLE public.advances
  ALTER COLUMN fee_amount TYPE numeric
  USING CASE 
    WHEN fee_amount IS NULL THEN NULL
    WHEN fee_amount ~ '^[0-9]+(\.[0-9]+)?$' THEN fee_amount::numeric
    ELSE NULL
  END;

-- ============================================================
-- FIX 3: policies.organization_id — rename to employer_id
-- to match what the FK actually points at (employers.id)
-- ============================================================
ALTER TABLE public.policies
  RENAME COLUMN organization_id TO employer_id;

ALTER TABLE public.policies
  RENAME CONSTRAINT policies_organization_id_fkey TO policies_employer_id_fkey;

