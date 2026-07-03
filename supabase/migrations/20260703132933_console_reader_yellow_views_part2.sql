CREATE OR REPLACE VIEW public.v_console_wiza_summary AS
SELECT
  'employee' AS surface,
  date_trunc('day', s.created_at) AS day,
  count(DISTINCT s.id) AS session_count,
  count(m.id) AS message_count
FROM public.wiza_sessions s
LEFT JOIN public.wiza_messages m ON m.session_id = s.id
WHERE s.created_at >= now() - interval '30 days'
GROUP BY 2
UNION ALL
SELECT
  'public' AS surface,
  date_trunc('day', s.created_at) AS day,
  count(DISTINCT s.id) AS session_count,
  count(m.id) AS message_count
FROM public.wiza_public_sessions s
LEFT JOIN public.wiza_public_messages m ON m.session_id = s.id
WHERE s.created_at >= now() - interval '30 days'
GROUP BY 2;

CREATE OR REPLACE VIEW public.v_console_dusupay_summary AS
SELECT
  event_type,
  status,
  currency,
  date_trunc('day', created_at) AS day,
  count(*) AS transaction_count,
  sum(amount) AS total_amount
FROM public.dusupay_transactions
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW public.v_console_wallet_summary AS
SELECT
  (SELECT coalesce(sum(balance), 0) FROM public.admin_wallets) AS total_admin_balance_usd,
  (SELECT count(*) FROM public.employer_wallets) AS employer_wallet_count,
  (SELECT coalesce(sum(outstanding_liability), 0) FROM public.employer_wallets) AS total_outstanding_liability,
  (SELECT coalesce(sum(total_advanced), 0) FROM public.employer_wallets) AS total_advanced,
  (SELECT coalesce(sum(total_repaid), 0) FROM public.employer_wallets) AS total_repaid,
  (SELECT coalesce(sum(reserved_amount), 0) FROM public.employer_wallets) AS total_reserved;

CREATE OR REPLACE VIEW public.v_console_wallet_tx_summary AS
SELECT 'employer' AS wallet_kind, type, status, date_trunc('day', created_at) AS day, count(*) AS tx_count, sum(amount) AS total_amount
FROM public.wallet_transactions
WHERE created_at >= now() - interval '30 days'
GROUP BY 2, 3, 4
UNION ALL
SELECT 'admin' AS wallet_kind, type, status, date_trunc('day', created_at) AS day, count(*) AS tx_count, sum(amount) AS total_amount
FROM public.admin_wallet_transactions
WHERE created_at >= now() - interval '30 days'
GROUP BY 2, 3, 4;

CREATE OR REPLACE VIEW public.v_console_audit_summary AS
SELECT action, target_type, date_trunc('day', created_at) AS day, count(*) AS action_count, count(DISTINCT admin_id) AS distinct_admins
FROM public.system_audit_logs
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2, 3;

-- Green-listed table with an embedded secret — restricted view instead of a
-- raw grant. Excludes webhook_secret and webhook_secret_encrypted entirely.
CREATE OR REPLACE VIEW public.v_console_payroll_integrations AS
SELECT id, employer_id, provider, provider_label, sync_mode, sync_frequency, sync_time,
       status, last_sync_at, last_sync_status, last_error, created_at, updated_at
FROM public.payroll_integrations;

GRANT SELECT ON public.v_console_login_summary TO console_reader;
GRANT SELECT ON public.v_console_failed_login_summary TO console_reader;
GRANT SELECT ON public.v_console_trusted_devices_summary TO console_reader;
GRANT SELECT ON public.v_console_fraud_summary TO console_reader;
GRANT SELECT ON public.v_console_fraud_rules_summary TO console_reader;
GRANT SELECT ON public.v_console_notifications_summary TO console_reader;
GRANT SELECT ON public.v_console_wiza_summary TO console_reader;
GRANT SELECT ON public.v_console_dusupay_summary TO console_reader;
GRANT SELECT ON public.v_console_wallet_summary TO console_reader;
GRANT SELECT ON public.v_console_wallet_tx_summary TO console_reader;
GRANT SELECT ON public.v_console_audit_summary TO console_reader;
GRANT SELECT ON public.v_console_payroll_integrations TO console_reader;

