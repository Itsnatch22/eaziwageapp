
-- Issue 9: employees — drop over-broad ALL policy and duplicate SELECT policies.
-- "Users can manage own employee record" (ALL) is superseded by the verb-scoped policies.
-- "Admins can view all employees" (SELECT) is superseded by admins_have_full_access_to_employees (ALL).
-- "Employees can view own record" (SELECT) duplicates employees_can_read_own_record.
DROP POLICY IF EXISTS "Users can manage own employee record" ON employees;
DROP POLICY IF EXISTS "Admins can view all employees" ON employees;
DROP POLICY IF EXISTS "Employees can view own record" ON employees;

-- Issue 10: employers — drop duplicate public read policy.
-- "Allow reading approved employers" duplicates "employers: public read approved".
DROP POLICY IF EXISTS "Allow reading approved employers" ON employers;

