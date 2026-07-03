-- Founder ops console (/console) — dedicated read-only Postgres role.
-- Access control is enforced here, at the grant level, not in application code.
-- BYPASSRLS is granted deliberately: this role's visibility is governed *entirely*
-- by the explicit table/view GRANTs below, not by RLS policies written for
-- authenticated/anon/service_role (which this role doesn't match, and would
-- otherwise silently return zero rows rather than a clear deny).
-- Password redacted for version control — the real value lives only in the
-- live role (already created) and in CONSOLE_DATABASE_URL in .env.local.
-- Replace <REDACTED> with a freshly generated password before ever re-running
-- this file; it is a historical record, not meant to be re-applied as-is.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'console_reader') THEN
    CREATE ROLE console_reader WITH LOGIN PASSWORD '<REDACTED>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END $$;

ALTER ROLE console_reader SET default_transaction_read_only = on;
GRANT USAGE ON SCHEMA public TO console_reader;

-- system_admins.is_founder — the single flag that gates /console access,
-- checked server-side against auth.uid(). Not an email string match.
ALTER TABLE public.system_admins ADD COLUMN IF NOT EXISTS is_founder boolean NOT NULL DEFAULT false;
UPDATE public.system_admins SET is_founder = true WHERE email = 'mark@eaziwage.com';

