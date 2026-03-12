-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Policy for system_admins table
-- Allows admins to read their own record (needed for middleware)
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can read their own system_admin record" ON system_admins;

-- Create new policy
CREATE POLICY "Users can read their own system_admin record"
ON system_admins
FOR SELECT
USING (auth.uid() = id);

-- Verify RLS is enabled
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;

-- This should return 1 row when run as the authenticated admin user
SELECT id, email, full_name FROM system_admins WHERE id = auth.uid();

-- ═══════════════════════════════════════════════════════════════════════════
-- IMPORTANT: This policy allows users to ONLY read their own row
-- The middleware uses this to check if a user is an admin
-- ═══════════════════════════════════════════════════════════════════════════