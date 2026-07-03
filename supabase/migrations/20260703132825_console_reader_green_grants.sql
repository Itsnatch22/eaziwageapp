-- Green tier — full raw-row read access.
-- payroll_integrations is deliberately EXCLUDED from this direct grant despite
-- being listed green in the spec: it has a plaintext webhook_secret column
-- (plus webhook_secret_encrypted) that must never reach an AI prompt or the
-- console UI. It gets a column-restricted view instead — see the next migration.
GRANT SELECT ON public.api_health TO console_reader;
GRANT SELECT ON public.error_logs TO console_reader;
GRANT SELECT ON public.incident_log TO console_reader;
GRANT SELECT ON public.payroll_sync_logs TO console_reader;
GRANT SELECT ON public.support_tickets TO console_reader;
GRANT SELECT ON public.ticket_replies TO console_reader;
GRANT SELECT ON public.blogs TO console_reader;
GRANT SELECT ON public.newsletter_subscriptions TO console_reader;
GRANT SELECT ON public.sales_leads TO console_reader;
GRANT SELECT ON public.partner_applications TO console_reader;
GRANT SELECT ON public.contacts TO console_reader;
GRANT SELECT ON public.exchange_rates TO console_reader;
GRANT SELECT ON public.payout_providers TO console_reader;
GRANT SELECT ON public.sectors TO console_reader;
GRANT SELECT ON public.global_settings TO console_reader;
GRANT SELECT ON public.announcements TO console_reader;

