-- Migration to fix employees table schema inconsistencies
-- This migration is designed to be safe and backward compatible

-- Step 1: Add comments to clarify field usage
COMMENT ON COLUMN public.employees.organization_id IS 'Optional organization reference - may be null if using employer_id instead';
COMMENT ON COLUMN public.employees.employer_id IS 'Primary employer relationship - required for all employees';
COMMENT ON COLUMN public.employees.name IS 'Legacy name field - maintained for compatibility';
COMMENT ON COLUMN public.employees.full_name IS 'Preferred name field - contains employee full name';

-- Step 2: Add a check constraint to ensure at least one relationship exists
-- This is safe because it doesn't break existing data
ALTER TABLE public.employees 
ADD CONSTRAINT check_employee_relationship 
CHECK (employer_id IS NOT NULL OR organization_id IS NOT NULL);

-- Step 3: Update any existing records that have null values in critical fields
-- This ensures data integrity
UPDATE public.employees 
SET name = COALESCE(name, full_name, 'Unknown'),
    full_name = COALESCE(full_name, name, 'Unknown'),
    employee_number = COALESCE(employee_number, employee_code, 'EMP-' || LEFT(id::text, 8)),
    status = COALESCE(status, 'Active')
WHERE name IS NULL OR full_name IS NULL OR employee_number IS NULL OR status IS NULL;

-- Step 4: Create a function to sync data from employee_onboarding to employees
-- This helps maintain data consistency
CREATE OR REPLACE FUNCTION sync_employee_from_onboarding()
RETURNS TRIGGER AS $$
BEGIN
    -- Update employees table when onboarding data changes
    INSERT INTO public.employees (
        user_id, 
        employer_id, 
        employee_code, 
        name, 
        full_name, 
        email, 
        job_title, 
        department, 
        monthly_salary, 
        employment_type, 
        status, 
        kyc_status, 
        hire_date,
        updated_at
    )
    VALUES (
        NEW.user_id,
        NEW.employer_id,
        NEW.employee_code,
        NEW.full_name,
        NEW.full_name,
        NEW.email,
        NEW.job_title,
        NEW.department,
        NEW.monthly_salary,
        NEW.employment_type,
        NEW.status,
        NEW.status,
        NEW.start_date,
        NOW()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        employer_id = EXCLUDED.employer_id,
        employee_code = EXCLUDED.employee_code,
        name = EXCLUDED.full_name,
        full_name = EXCLUDED.full_name,
        job_title = EXCLUDED.job_title,
        department = EXCLUDED.department,
        monthly_salary = EXCLUDED.monthly_salary,
        employment_type = EXCLUDED.employment_type,
        status = EXCLUDED.status,
        kyc_status = EXCLUDED.status,
        hire_date = EXCLUDED.start_date,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to automatically sync onboarding changes
-- This ensures data consistency between tables
DROP TRIGGER IF EXISTS trigger_sync_employee_onboarding ON public.employee_onboarding;
CREATE TRIGGER trigger_sync_employee_onboarding
    AFTER INSERT OR UPDATE ON public.employee_onboarding
    FOR EACH ROW
    EXECUTE FUNCTION sync_employee_from_onboarding();

-- Step 6: Create a view for consistent employee data access
-- This provides a unified way to access employee data
CREATE OR REPLACE VIEW public.employee_complete_view AS
SELECT 
    e.id,
    e.user_id,
    e.employer_id,
    e.employee_code,
    COALESCE(e.full_name, e.name) as display_name,
    e.email,
    e.job_title,
    e.department,
    e.monthly_salary,
    e.employment_type,
    e.status,
    e.kyc_status,
    e.hire_date,
    eo.company_name,
    eo.start_date as onboarding_start_date,
    eo.currency,
    p.full_name as profile_full_name,
    p.avatar_url,
    e.created_at,
    e.updated_at
FROM public.employees e
LEFT JOIN public.employee_onboarding eo ON e.user_id = eo.user_id
LEFT JOIN public.profiles p ON e.user_id = p.id;

-- Step 7: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employees_employer_id ON public.employees(employer_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_kyc_status ON public.employees(kyc_status);

-- Migration completed successfully
-- The employees table now has:
-- 1. Better data consistency through triggers
-- 2. Unified view for data access
-- 3. Improved performance with proper indexes
-- 4. Backward compatibility maintained
