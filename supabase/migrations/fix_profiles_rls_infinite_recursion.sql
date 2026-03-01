-- =============================================================================
-- MIGRATION: Fix RLS infinite recursion + unify admin/profile schemas
-- =============================================================================
-- Run this in your Supabase SQL editor (as superuser / service role).
-- Safe to run multiple times (all statements are idempotent).
-- =============================================================================


-- ─── 1. ADD MISSING COLUMNS TO system_admins ─────────────────────────────────
-- The route.ts now reads/writes failed_login_attempts and locked_until on
-- system_admins, so the columns must exist.

ALTER TABLE public.system_admins
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until          timestamptz;


-- ─── 2. ADD role_normalized TO public.profiles (if not already present) ──────
-- The original schema migration created profile.profiles (a separate schema)
-- but route.ts and proxy.ts query public.profiles. Ensure the column exists
-- in the correct schema.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_normalized text
    GENERATED ALWAYS AS (
      CASE
        WHEN is_admin          THEN 'admin'
        WHEN role = 'employer' THEN 'employer'
        WHEN role = 'employee' THEN 'employee'
        ELSE 'unknown'
      END
    ) STORED;

-- If your Postgres version doesn't support generated columns or you already
-- have a non-generated role_normalized, comment out the block above and use:
--
--   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_normalized text;
--   UPDATE public.profiles SET role_normalized =
--     CASE WHEN is_admin THEN 'admin' ELSE role END
--   WHERE role_normalized IS NULL;


-- ─── 3. DROP RECURSIVE RLS POLICIES ON public.profiles ───────────────────────
-- The infinite recursion error means an existing policy does something like:
--   USING (id IN (SELECT id FROM profiles WHERE ...))
-- We replace ALL policies on profiles with simple, non-recursive ones.

-- Drop every existing policy on profiles (names may vary — drop by pattern)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM   pg_policies
    WHERE  schemaname = 'public'
    AND    tablename  = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END
$$;

-- Re-enable RLS (in case it was disabled during debugging)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── 3a. Users can read and update their own profile ──────────────────────────
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());

-- ── 3b. Service role bypasses RLS completely (used by route.ts) ──────────────
-- The Supabase service role already bypasses RLS by default; no policy needed.
-- The policies above cover the anon/authenticated role used in middleware.

-- ── 3c. Allow INSERT for the registration flow ────────────────────────────────
-- The /register route (not shown) calls supabaseAdmin.from('profiles').insert()
-- via the service role, so no client-side INSERT policy is needed.
-- If you do need client-side INSERT (e.g. for a trigger workaround), add:
--
-- CREATE POLICY "profiles_insert_own"
--   ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());


-- ─── 4. SYSTEM_ADMINS RLS ────────────────────────────────────────────────────

-- Drop existing policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM   pg_policies
    WHERE  schemaname = 'public'
    AND    tablename  = 'system_admins'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_admins', pol.policyname);
  END LOOP;
END
$$;

ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;

-- Admins can read their own row (used by middleware to confirm admin status)
CREATE POLICY "system_admins_select_own"
  ON public.system_admins
  FOR SELECT
  USING (id = auth.uid());

-- Service role handles all inserts/updates (route.ts uses supabaseAdmin)


-- ─── 5. SYNC EXISTING DATA ────────────────────────────────────────────────────
-- Backfill any admin emails from env into system_admins.
-- Replace the email list below with your actual ADMIN_EMAILS values.
-- (This is the same as the original system_admins seed, kept idempotent.)

INSERT INTO public.system_admins (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email)
FROM auth.users u
WHERE u.email IN (
  'kamaumark996@gmail.com',
  'joel@eaziwage.com',
  'henry@eaziwage.com',
  'jason@eaziwage.com'
)
ON CONFLICT (id) DO NOTHING;


-- ─── 6. DROP THE ORPHANED profile SCHEMA ─────────────────────────────────────
-- The migration in the problem statement accidentally created a second schema
-- called "profile" (not "public"). route.ts and proxy.ts both query
-- public.profiles, so profile.profiles is dead code and causes confusion.
--
-- Only run the lines below if you are CERTAIN profile.profiles has no data
-- you need, or after you have migrated it.

-- DROP TABLE IF EXISTS profile.profiles;
-- DROP SCHEMA IF EXISTS profile;

-- If you need to keep the data, migrate it first:
--
-- INSERT INTO public.profiles (id, full_name, email, phone, company_name,
--   role, is_admin, created_at, last_login_at)
-- SELECT id, full_name, email, phone, company_name,
--   COALESCE(role_normalized, 'employee') AS role, is_admin,
--   created_at, last_login_at
-- FROM profile.profiles pp
-- WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pp.id);


-- ─── 7. VERIFICATION QUERIES ──────────────────────────────────────────────────
-- Run these after applying the migration to confirm everything looks right.

-- Check policies are non-recursive:
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('profiles', 'system_admins')
-- ORDER BY tablename, policyname;

-- Check system_admins rows exist:
-- SELECT id, email, full_name, failed_login_attempts, locked_until
-- FROM public.system_admins;

-- Check public.profiles columns:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'profiles'
-- ORDER BY ordinal_position;
