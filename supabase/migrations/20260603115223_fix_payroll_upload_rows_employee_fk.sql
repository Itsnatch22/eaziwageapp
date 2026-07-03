
-- Step 1: Add a new column for the correct employees FK
ALTER TABLE public.payroll_upload_rows
ADD COLUMN IF NOT EXISTS live_employee_id uuid;

-- Step 2: Populate it by mapping employee_onboarding.id → employees.id via user_id
UPDATE public.payroll_upload_rows pur
SET live_employee_id = e.id
FROM public.employee_onboarding eo
JOIN public.employees e ON e.user_id = eo.user_id
WHERE eo.id = pur.employee_id;

-- Step 3: Add FK constraint to employees
ALTER TABLE public.payroll_upload_rows
ADD CONSTRAINT payroll_upload_rows_live_employee_id_fkey
FOREIGN KEY (live_employee_id) REFERENCES public.employees (id) ON DELETE SET NULL;

-- Step 4: Add index on the new column
CREATE INDEX IF NOT EXISTS idx_payroll_upload_rows_live_employee_id
ON public.payroll_upload_rows (live_employee_id);

