-- /api/auth/forgot-password only looks up public.profiles to find a user for a
-- password-reset token — founders/admins who only exist in system_admins (and
-- never went through the normal employer/employee onboarding flow that creates
-- a profiles row) could never request a reset link. system_admins itself is left
-- completely untouched; this only adds the missing profiles rows so these admins
-- are also discoverable by email for password resets and any other profiles-based
-- lookup. phone is left as '' (no real number on file for any of these four) —
-- profiles.phone has no format CHECK constraint, only NOT NULL.
INSERT INTO public.profiles (
  id, full_name, email, phone, phone_country_code, role, role_normalized,
  is_admin, is_active, email_verified, onboarding_complete, created_at, updated_at
)
SELECT
  sa.id, sa.full_name, sa.email, '', 'KE', 'admin', 'admin',
  true, true, true, true, sa.created_at, now()
FROM public.system_admins sa
WHERE sa.email IN ('mark@eaziwage.com', 'joel@eaziwage.com', 'henry@eaziwage.com', 'jason@eaziwage.com')
ON CONFLICT (id) DO NOTHING;
