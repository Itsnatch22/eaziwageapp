
-- Helper function: returns true only if the employer is approved or suspended
-- (suspended employers may still have existing employees)
CREATE OR REPLACE FUNCTION is_live_employer(eid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS (
       SELECT 1 FROM employers 
       WHERE id = eid 
       AND status IN ('approved', 'suspended')
     ) $$;

-- Check constraint: employees can only be linked to live employers
ALTER TABLE employees
  ADD CONSTRAINT employees_employer_must_be_live
  CHECK (is_live_employer(employer_id));

