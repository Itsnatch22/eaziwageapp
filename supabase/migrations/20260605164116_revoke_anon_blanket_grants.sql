
-- ============================================================
-- STEP 1: Revoke ALL privileges from anon on every table
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- ============================================================
-- STEP 2: Re-grant ONLY what anon legitimately needs
-- ============================================================

-- Public-facing content (marketing site, blogs, legal docs)
GRANT SELECT ON public.blogs TO anon;
GRANT SELECT ON public.legal_documents TO anon;
GRANT SELECT ON public.sectors TO anon;
GRANT SELECT ON public.public_stats TO anon;
GRANT SELECT ON public.announcements TO anon;
GRANT SELECT ON public.approved_employers_public TO anon;
GRANT SELECT ON public.exchange_rates TO anon;
GRANT SELECT ON public.blackout_periods TO anon;
GRANT SELECT ON public.withdrawal_limits TO anon;

-- Public write actions (no auth needed)
GRANT INSERT ON public.contacts TO anon;
GRANT INSERT ON public.newsletter_subscriptions TO anon;
GRANT INSERT ON public.partner_applications TO anon;
GRANT INSERT ON public.sales_leads TO anon;
GRANT INSERT ON public.cookie_consents TO anon;
GRANT INSERT ON public.termination_feedback TO anon;

-- Wiza public chatbot (unauthenticated visitors)
GRANT SELECT, INSERT, UPDATE ON public.wiza_public_sessions TO anon;
GRANT SELECT, INSERT ON public.wiza_public_messages TO anon;

