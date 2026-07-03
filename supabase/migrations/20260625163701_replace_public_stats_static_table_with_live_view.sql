
-- Drop the static table and replace with a live view
DROP TABLE IF EXISTS public_stats;

CREATE OR REPLACE VIEW public_stats AS
SELECT
  1 AS id,
  (SELECT COUNT(*) FROM profiles) AS total_users,
  (SELECT COUNT(*) FROM employers WHERE status = 'approved') AS active_employers,
  (SELECT COUNT(*) FROM employees WHERE status = 'Active') AS active_employees,
  (SELECT COALESCE(SUM(amount), 0) FROM advances WHERE status = 'disbursed') AS total_disbursed,
  NOW() AS updated_at;

-- Reapply anon read policy via RLS-equivalent: grant SELECT to anon role
GRANT SELECT ON public_stats TO anon;

