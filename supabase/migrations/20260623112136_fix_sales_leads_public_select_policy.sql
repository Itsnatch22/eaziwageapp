
-- Drop the permissive qual=true policy
DROP POLICY "Allow admin read" ON sales_leads;

-- Replace with admin-only SELECT
CREATE POLICY "admins_can_read_sales_leads"
  ON sales_leads
  FOR SELECT
  TO authenticated
  USING (current_user_is_admin());

