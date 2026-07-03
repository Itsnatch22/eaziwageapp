-- Yellow tier — aggregate/count views only. console_reader gets SELECT on
-- these views, never on the underlying raw tables.

CREATE OR REPLACE VIEW public.v_console_login_summary AS
SELECT
  date_trunc('day', logged_in_at) AS day,
  success,
  count(*) AS attempt_count,
  count(DISTINCT user_id) AS distinct_users,
  count(DISTINCT ip_address) AS distinct_ips
FROM public.login_history
WHERE logged_in_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.v_console_failed_login_summary AS
SELECT
  date_trunc('day', attempted_at) AS day,
  reason,
  count(*) AS attempt_count,
  count(DISTINCT ip_address) AS distinct_ips
FROM public.failed_login_attempts
WHERE attempted_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.v_console_trusted_devices_summary AS
SELECT
  count(*) AS total_devices,
  count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS added_last_7d,
  count(*) FILTER (WHERE last_used_at >= now() - interval '7 days') AS active_last_7d
FROM public.trusted_devices;

CREATE OR REPLACE VIEW public.v_console_fraud_summary AS
SELECT
  'flags' AS source, severity, status, date_trunc('day', created_at) AS day, count(*) AS item_count
FROM public.fraud_flags
WHERE created_at >= now() - interval '30 days'
GROUP BY 2, 3, 4
UNION ALL
SELECT
  'alerts' AS source, severity, status, date_trunc('day', created_at) AS day, count(*) AS item_count
FROM public.fraud_alerts
WHERE created_at >= now() - interval '30 days'
GROUP BY 2, 3, 4;

CREATE OR REPLACE VIEW public.v_console_fraud_rules_summary AS
SELECT rule_type, severity, enabled, count(*) AS rule_count, sum(trigger_count) AS total_triggers
FROM public.fraud_rules
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW public.v_console_notifications_summary AS
SELECT
  type,
  delivery_status,
  urgency,
  date_trunc('day', created_at) AS day,
  count(*) AS item_count
FROM public.notifications
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2, 3, 4;

