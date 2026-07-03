
DROP VIEW IF EXISTS public_stats;

CREATE OR REPLACE VIEW stats
WITH (security_invoker = false)
AS
SELECT
  1 AS id,
  (SELECT COUNT(*) FROM profiles) AS total_users,
  (SELECT COUNT(*) FROM employers WHERE status = 'approved') AS active_employers,
  (SELECT COUNT(*) FROM employees WHERE status = 'Active') AS active_employees,
  (SELECT COALESCE(SUM(amount), 0) FROM advances WHERE status = 'disbursed') AS total_disbursed,
  (SELECT COUNT(*) FROM advances WHERE status = 'pending') AS pending_advances,
  (SELECT COUNT(*) FROM advances WHERE status = 'disbursed') AS total_advances,
  (SELECT COALESCE(SUM(amount), 0) FROM advances WHERE status = 'pending') AS pending_disbursed,
  NOW() AS updated_at;

GRANT SELECT ON stats TO anon, authenticated;

