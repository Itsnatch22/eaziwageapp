
-- Drop the view
DROP VIEW IF EXISTS stats;

-- Create a SECURITY DEFINER RPC instead
CREATE OR REPLACE FUNCTION get_stats()
RETURNS TABLE (
  total_users bigint,
  active_employers bigint,
  active_employees bigint,
  total_disbursed numeric,
  pending_advances bigint,
  total_advances bigint,
  pending_disbursed numeric,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM profiles)::bigint,
    (SELECT COUNT(*) FROM employers WHERE status = 'approved')::bigint,
    (SELECT COUNT(*) FROM employees WHERE status = 'Active')::bigint,
    (SELECT COALESCE(SUM(amount), 0) FROM advances WHERE status = 'disbursed'),
    (SELECT COUNT(*) FROM advances WHERE status = 'pending')::bigint,
    (SELECT COUNT(*) FROM advances WHERE status = 'disbursed')::bigint,
    (SELECT COALESCE(SUM(amount), 0) FROM advances WHERE status = 'pending'),
    NOW();
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION get_stats() TO anon, authenticated;

